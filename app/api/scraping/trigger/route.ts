import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server-client';

const MAX_PRODUCTS_PER_JOB = 12;

/**
 * POST /api/scraping/trigger
 * Manually triggers scraping for a specific store
 * Admin/cron endpoint for batch processing
 * 
 * Body:
 * {
 *   storeId: string,
 *   products: string[],
 *   brand?: string
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json(
                { error: 'CRON_SECRET is not configured' },
                { status: 503 }
            );
        }

        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const storeId = typeof body?.storeId === 'string' ? body.storeId : '';
        const products = Array.isArray(body?.products)
            ? body.products
                .filter((entry: unknown): entry is string => typeof entry === 'string')
                .map((entry: string) => entry.trim())
                .filter(Boolean)
                .slice(0, MAX_PRODUCTS_PER_JOB)
            : [];

        if (!storeId || products.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const serviceClient = getSupabaseServiceClient();

        // Fetch store details
        const { data: store, error: storeError } = await serviceClient
            .from('nearby_stores')
            .select('id, name, brand, scraping_enabled')
            .eq('id', storeId)
            .single();

        if (storeError || !store) {
            return NextResponse.json(
                { error: 'Store not found' },
                { status: 404 }
            );
        }

        if (!store.scraping_enabled) {
            return NextResponse.json(
                { error: 'Scraping disabled for this store' },
                { status: 403 }
            );
        }

        // Create scraping job as pending. A cron/worker endpoint should process this queue.
        const { data: job, error: jobError } = await serviceClient
            .from('scraping_jobs')
            .insert({
                store_id: storeId,
                search_query: products.join(', '),
                status: 'pending',
            })
            .select('id, store_id, search_query, status, created_at')
            .single();

        if (jobError || !job) {
            console.error('[API /scraping/trigger] Failed to enqueue job:', jobError);
            return NextResponse.json(
                { error: 'Could not enqueue scraping job' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Scraping job queued',
            job_id: job.id,
            status: job.status,
        }, { status: 202 });
    } catch (error) {
        console.error('[API /scraping/trigger] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
