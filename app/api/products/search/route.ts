import { NextRequest, NextResponse } from 'next/server';
import { searchNearbyProducts } from '@/lib/scraping/orchestrator';
import { createClient } from '@/lib/supabase/server';
import { tryUpstashLimit } from '@/lib/upstash/ratelimit';

const MAX_STORES_CAP = 5;

/**
 * POST /api/products/search
 * Searches for products in nearby stores
 * 
 * Body:
 * {
 *   lat: number,
 *   lon: number,
 *   query: string,
 *   forceRefresh?: boolean,
 *   maxStores?: number
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const forwarded = request.headers.get('x-forwarded-for') || null;
        const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || null;
        const rateLimitResult = await tryUpstashLimit(`products_search:${ip ?? 'unknown'}`);
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded' },
                { status: 429 }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let intolerances: string[] = [];

        if (user) {
            // Fetch user profile to get intolerances
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('intolerances')
                .eq('user_id', user.id)
                .single();
            
            if (profile && profile.intolerances) {
                intolerances = profile.intolerances;
            }
        }

        const body = await request.json();
        const { lat, lon, query, forceRefresh, maxStores } = body;
        const parsedLat = Number(lat);
        const parsedLon = Number(lon);
        const parsedMaxStores = Number(maxStores);
        const boundedMaxStores = Number.isFinite(parsedMaxStores)
            ? Math.max(1, Math.min(MAX_STORES_CAP, Math.floor(parsedMaxStores)))
            : MAX_STORES_CAP;
        const allowForceRefresh = Boolean(forceRefresh) && Boolean(user);

        // Validate inputs
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon) || !query) {
            return NextResponse.json(
                { error: 'Missing required parameters: lat, lon, query' },
                { status: 400 }
            );
        }

        if (typeof query !== 'string' || query.trim().length < 2) {
            return NextResponse.json(
                { error: 'Query must be at least 2 characters' },
                { status: 400 }
            );
        }

        if (parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) {
            return NextResponse.json(
                { error: 'Invalid coordinates' },
                { status: 400 }
            );
        }

        // Check if scraping is enabled (disabled for now to allow testing)
        // if (process.env.SCRAPING_ENABLED !== 'true') {
        //     return NextResponse.json(
        //         { error: 'Product search is currently disabled' },
        //         { status: 503 }
        //     );
        // }

        // Execute search
        // Strategy: First check DB, if empty/stale, trigger background scrape (or return empty with "loading" status)
        // For now, we keep the existing orchestrator logic which does: Cache -> Scrape -> Return
        // But we optimize it to prefer DB results if available.
        
        const results = await searchNearbyProducts(
            parsedLat,
            parsedLon,
            query.trim(),
            allowForceRefresh,
            boundedMaxStores,
            intolerances
        );

        // If we found 0 products but the query is common, we might want to trigger a background scrape for next time
        return NextResponse.json({
            success: true,
            ...results,
            query: query.trim(),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[API /products/search] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/products/search
 * Alternative endpoint for cached searches only
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const lat = parseFloat(searchParams.get('lat') || '');
        const lon = parseFloat(searchParams.get('lon') || '');
        const query = searchParams.get('query') || '';

        if (!lat || !lon || !query) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Only check cache, don't trigger scraping
        const results = await searchNearbyProducts(
            lat,
            lon,
            query,
            false, // Never force refresh on GET
            0 // Don't scrape, only cache
        );

        return NextResponse.json({
            success: true,
            ...results,
            query,
        });
    } catch (error) {
        console.error('[API GET /products/search] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
