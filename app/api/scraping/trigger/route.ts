import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cotoAdapter } from '@/lib/scraping/adapters/coto';
import { carrefourAdapter } from '@/lib/scraping/adapters/carrefour';
import { jumboAdapter, veaAdapter, discoAdapter } from '@/lib/scraping/adapters/jumbo';
import type { StoreAdapter } from '@/lib/scraping/types';
 
const brandAdapters: Record<string, StoreAdapter> = {
    COTO: cotoAdapter,
    CARREFOUR: carrefourAdapter,
    JUMBO: jumboAdapter,
    VEA: veaAdapter,
    DISCO: discoAdapter,
};

function pickAdapter(brand?: string | null): StoreAdapter | null {
    if (!brand) return null;
    const normalized = brand.toUpperCase();
    return brandAdapters[normalized] ?? null;
}

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
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Require authentication (could also check for admin role)
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { storeId, products, brand } = body;

        if (!storeId || !products || !Array.isArray(products)) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        // Fetch store details
        const { data: store, error: storeError } = await supabase
            .from('nearby_stores')
            .select('*')
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

        const adapter = pickAdapter(brand || store.brand);
        if (!adapter) {
            return NextResponse.json(
                { error: 'Unsupported store brand' },
                { status: 400 }
            );
        }

        // Create scraping job
        const { data: job } = await supabase
            .from('scraping_jobs')
            .insert({
                store_id: storeId,
                search_query: products.join(', '),
                status: 'running',
                started_at: new Date().toISOString(),
            })
            .select()
            .single();

        // Execute scraping in background (non-blocking)
        scrapeInBackground(store, products, adapter, job.id, supabase);

        return NextResponse.json({
            success: true,
            message: 'Scraping job started',
            job_id: job.id,
        });
    } catch (error) {
        console.error('[API /scraping/trigger] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Background scraping execution
 */
async function scrapeInBackground(
    store: any,
    products: string[],
    adapter: StoreAdapter,
    jobId: string,
    supabase: any
): Promise<void> {
    let totalProducts = 0;

    try {
        for (const productQuery of products) {
            const extractedProducts = await adapter.scrape(productQuery, {
                storeBrand: store.brand,
                storeId: store.id,
                storeName: store.name,
                storeWebsite: store.website_url,
            });

            // Persist products
            const records = extractedProducts.map(p => ({
                store_id: store.id,
                product_name: p.product_name,
                brand: p.brand,
                price_current: p.price_current,
                price_regular: p.price_regular,
                unit: p.unit,
                nutritional_claims: p.nutritional_claims,
                nutrition_info: p.nutrition_info,
                image_url: p.image_url,
                product_url: p.product_url,
            }));

            await supabase.from('scraped_products').insert(records);
            totalProducts += extractedProducts.length;
        }

        // Update job status
        await supabase
            .from('scraping_jobs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                products_found: totalProducts,
            })
            .eq('id', jobId);
    } catch (error) {
        console.error('[Background Scraper] Error:', error);
        await supabase
            .from('scraping_jobs')
            .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('id', jobId);
    }
}
