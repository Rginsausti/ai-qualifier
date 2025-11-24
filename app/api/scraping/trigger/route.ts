import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scrapeStoreProducts } from '@/lib/scraping/headless-scraper';
import { parseProductsWithGroq } from '@/lib/scraping/groq-parser';
import { getCotoConfig } from '@/lib/scraping/adapters/coto';
import { getCarrefourConfig } from '@/lib/scraping/adapters/carrefour';
import { getJumboConfig } from '@/lib/scraping/adapters/jumbo';

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

        // Get adapter config
        let config;
        switch (brand || store.brand) {
            case 'COTO':
                config = getCotoConfig();
                break;
            case 'CARREFOUR':
                config = getCarrefourConfig();
                break;
            case 'JUMBO':
            case 'VEA':
            case 'DISCO':
                config = getJumboConfig(brand as any);
                break;
            default:
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
        scrapeInBackground(store, products, config, job.id, supabase);

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
    config: any,
    jobId: string,
    supabase: any
): Promise<void> {
    let totalProducts = 0;

    try {
        for (const productQuery of products) {
            const html = await scrapeStoreProducts(
                store.website_url,
                productQuery,
                config
            );

            const extractedProducts = await parseProductsWithGroq(html, {
                storeBrand: store.brand,
                searchQuery: productQuery,
                baseUrl: store.website_url,
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
