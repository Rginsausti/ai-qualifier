"use server";

import geohash from 'geohash';
import { createClient } from "@/lib/supabase/server";
import { findNearbyStores, type NearbyStore } from './osm-discovery';
import { scrapeStoreProducts } from './headless-scraper';
import { parseProductsWithGroq, validateProduct, type ProductData } from './groq-parser';
import { getCotoConfig } from './adapters/coto';
import { getCarrefourConfig, getPostalCodeFromCoords } from './adapters/carrefour';
import { getJumboConfig } from './adapters/jumbo';

/**
 * Aggregated product results with store context
 */
export type AggregatedProduct = ProductData & {
    store_id: string;
    store_name: string;
    store_brand?: string;
    distance_meters: number;
};

/**
 * Result structure for product search
 */
export type AggregatedProductResults = {
    products: AggregatedProduct[];
    stores_searched: number;
    cache_hit: boolean;
    search_latency_ms: number;
};

/**
 * Main orchestration function for hyperlocal product search
 * @param userLat - User's latitude
 * @param userLon - User's longitude
 * @param productQuery - Search term (e.g., "leche descremada")
 * @param forceRefresh - Skip cache and scrape fresh data
 * @param maxStores - Maximum stores to scrape (default: 5)
 * @returns Aggregated products from nearby stores
 */
export async function searchNearbyProducts(
    userLat: number,
    userLon: number,
    productQuery: string,
    forceRefresh: boolean = false,
    maxStores: number = 5
): Promise<AggregatedProductResults> {
    const startTime = Date.now();

    try {
        // 1. Check cache first (unless forced refresh)
        if (!forceRefresh) {
            const cachedResult = await checkCache(userLat, userLon, productQuery);
            if (cachedResult) {
                console.log('[Orchestrator] Cache hit!');
                return {
                    ...cachedResult,
                    cache_hit: true,
                    search_latency_ms: Date.now() - startTime,
                };
            }
        }

        console.log('[Orchestrator] Cache miss, starting fresh search');

        // 2. Discover nearby stores via OSM
        const nearbyStores = await findNearbyStores(userLat, userLon, 2000);
        console.log(`[Orchestrator] Found ${nearbyStores.length} nearby stores`);

        if (nearbyStores.length === 0) {
            return {
                products: [],
                stores_searched: 0,
                cache_hit: false,
                search_latency_ms: Date.now() - startTime,
            };
        }

        // 3. Filter stores we can scrape (have adapters for)
        const scrapableStores = nearbyStores
            .filter(store => store.brand && ['COTO', 'CARREFOUR', 'JUMBO', 'VEA', 'DISCO'].includes(store.brand))
            .slice(0, maxStores);

        console.log(`[Orchestrator] ${scrapableStores.length} scrapable stores`);

        // 4. Scrape stores in parallel (with concurrency limit)
        const allProducts = await scrapeStoresInParallel(
            scrapableStores,
            productQuery,
            userLat,
            userLon
        );

        // 5. Cache results for 24 hours
        await cacheResults(userLat, userLon, productQuery, allProducts);

        return {
            products: allProducts,
            stores_searched: scrapableStores.length,
            cache_hit: false,
            search_latency_ms: Date.now() - startTime,
        };
    } catch (error) {
        console.error('[Orchestrator] Search error:', error);
        return {
            products: [],
            stores_searched: 0,
            cache_hit: false,
            search_latency_ms: Date.now() - startTime,
        };
    }
}

/**
 * Checks cache for existing results
 */
async function checkCache(
    lat: number,
    lon: number,
    query: string
): Promise<Omit<AggregatedProductResults, 'cache_hit' | 'search_latency_ms'> | null> {
    try {
        const supabase = await createClient();
        const hash = geohash.encode(lat, lon, 6); // ~1.2km precision

        const { data, error } = await supabase
            .from('product_search_cache')
            .select('results, result_count')
            .eq('geohash', hash)
            .eq('query', query.toLowerCase())
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !data) return null;

        return {
            products: data.results as AggregatedProduct[],
            stores_searched: data.result_count || 0,
        };
    } catch (error) {
        console.error('[Cache] Check error:', error);
        return null;
    }
}

/**
 * Caches search results with geohash
 */
async function cacheResults(
    lat: number,
    lon: number,
    query: string,
    products: AggregatedProduct[]
): Promise<void> {
    try {
        const supabase = await createClient();
        const hash = geohash.encode(lat, lon, 6);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await supabase.from('product_search_cache').upsert(
            {
                geohash: hash,
                query: query.toLowerCase(),
                results: products,
                result_count: products.length,
                expires_at: expiresAt.toISOString(),
            },
            { onConflict: 'geohash,query' }
        );
    } catch (error) {
        console.error('[Cache] Store error:', error);
    }
}

/**
 * Scrapes multiple stores in parallel with concurrency control
 */
async function scrapeStoresInParallel(
    stores: NearbyStore[],
    query: string,
    userLat: number,
    userLon: number
): Promise<AggregatedProduct[]> {
    const CONCURRENCY = 3; // Max 3 stores at once
    const results: AggregatedProduct[] = [];

    // Process in batches
    for (let i = 0; i < stores.length; i += CONCURRENCY) {
        const batch = stores.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map(store =>
            scrapeSingleStore(store, query, userLat, userLon)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
                results.push(...result.value);
            }
        }
    }

    return results;
}

/**
 * Scrapes a single store and returns aggregated products
 */
async function scrapeSingleStore(
    store: NearbyStore,
    query: string,
    userLat: number,
    userLon: number
): Promise<AggregatedProduct[]> {
    try {
        console.log(`[Scraper] Starting ${store.brand} - ${store.name}`);

        // Get store-specific config
        const config = getStoreConfig(store, userLat, userLon);
        if (!config || !store.website_url) {
            console.warn(`[Scraper] No config for ${store.brand}`);
            return [];
        }

        // Scrape HTML
        const html = await scrapeStoreProducts(store.website_url, query, config);

        if (!html || html.length < 200) {
            console.warn(`[Scraper] Empty HTML from ${store.brand}`);
            return [];
        }

        // Parse with Groq
        const products = await parseProductsWithGroq(html, {
            storeBrand: store.brand || store.name,
            searchQuery: query,
            baseUrl: store.website_url,
        });

        // Persist to database
        const supabase = await createClient();
        await persistProducts(products, store.id!, supabase);

        // Add store context
        const aggregated: AggregatedProduct[] = products.map(p => ({
            ...validateProduct(p),
            store_id: store.id!,
            store_name: store.name,
            store_brand: store.brand,
            distance_meters: store.distance || 0,
        }));

        console.log(`[Scraper] ${store.brand}: ${aggregated.length} products`);
        return aggregated;
    } catch (error) {
        console.error(`[Scraper] Error scraping ${store.brand}:`, error);
        return [];
    }
}

/**
 * Gets adapter config for a store
 */
function getStoreConfig(store: NearbyStore, lat: number, lon: number) {
    switch (store.brand) {
        case 'COTO':
            return getCotoConfig();
        case 'CARREFOUR':
            const postalCode = getPostalCodeFromCoords(lat, lon);
            return getCarrefourConfig(undefined, postalCode);
        case 'JUMBO':
            return getJumboConfig('JUMBO');
        case 'VEA':
            return getJumboConfig('VEA');
        case 'DISCO':
            return getJumboConfig('DISCO');
        default:
            return null;
    }
}

/**
 * Persists scraped products to database
 */
async function persistProducts(
    products: ProductData[],
    storeId: string,
    supabase: any
): Promise<void> {
    try {
        const records = products.map(p => ({
            store_id: storeId,
            product_name: p.product_name,
            brand: p.brand,
            price_current: p.price_current,
            price_regular: p.price_regular,
            unit: p.unit,
            quantity: p.quantity,
            nutritional_claims: p.nutritional_claims,
            nutrition_info: p.nutrition_info,
            image_url: p.image_url,
            product_url: p.product_url,
        }));

        const { error } = await supabase.from('scraped_products').insert(records);
        if (error) {
            console.error('[DB] Insert error:', error);
        }
    } catch (error) {
        console.error('[DB] Persist error:', error);
    }
}
