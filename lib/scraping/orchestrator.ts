// Orchestrator for nearby product search
import { GeoHash } from 'geohash';
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from '@supabase/supabase-js';
import { findNearbyStores, type NearbyStore } from './osm-discovery';
import { type Product, type StoreAdapter } from './types';
import { cotoAdapter } from './adapters/coto';
import { carrefourAdapter } from './adapters/carrefour';
import { jumboAdapter, veaAdapter, discoAdapter } from './adapters/jumbo';

const ADAPTER_MAP: Record<string, StoreAdapter> = {
    'COTO': cotoAdapter,
    'CARREFOUR': carrefourAdapter,
    'JUMBO': jumboAdapter,
    'VEA': veaAdapter,
    'DISCO': discoAdapter,
};

const encodeGeohash = (lat: number, lon: number, precision = 6) => {
    const hash = GeoHash.encodeGeoHash(lat, lon);
    return hash.substring(0, precision);
};

export type AggregatedProduct = Product & {
    store_id: string;
    store_name: string;
    store_brand?: string;
    distance_meters: number;
    store_lat: number;
    store_lon: number;
};

export type AggregatedProductResults = {
    products: AggregatedProduct[];
    stores_searched: number;
    cache_hit: boolean;
    search_latency_ms: number;
    filtered_out_count?: number;
};

// --- Intolerance Filtering Logic ---

type IntoleranceConfig = {
    id: string;
    synonyms: string[];
    blocked: string[];
    safe: string[];
};

const INTOLERANCE_CONFIGS: IntoleranceConfig[] = [
    {
        id: 'lactose',
        synonyms: ['lactosa', 'lactose', 'intolerancia lactosa', 'intolerancia a la lactosa', 'dairy', 'lacteos', 'lacteos'],
        blocked: [
            'lactosa',
            'lacte',
            'leche',
            'queso',
            'quesos',
            'yogur',
            'yoghurt',
            'crema',
            'manteca',
            'mantecol',
            'dulce de leche',
            'ricota',
            'provolone',
            'muzzarella',
            'quesillo',
            'gruyere',
            'requeson'
        ],
        safe: ['sin lactosa', 'libre de lactosa', 'vegano', 'vegetal', 'plant based', 'origen vegetal', '100% vegetal']
    },
    {
        id: 'gluten',
        synonyms: ['gluten', 'celiaco', 'celiac', 'tacc', 'celiaquia'],
        blocked: ['gluten', 'trigo', 'harina', 'pan', 'cebada', 'centeno', 'pastas', 'fideos', 'pizza', 'empanada', 'galleta'],
        safe: ['sin tacc', 'libre de gluten', 'gluten free']
    },
    {
        id: 'peanut',
        synonyms: ['mani', 'maní', 'peanut', 'cacahuate', 'frutos secos', 'nuts', 'almendra', 'avellana', 'nueces'],
        blocked: ['mani', 'maní', 'cacahuate', 'almendra', 'avellana', 'nuez', 'nueces', 'pistacho', 'huevo de mani'],
        safe: ['sin frutos secos', 'libre de frutos secos']
    }
];

const normalizeText = (value?: string) =>
    (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\W_]+/g, ' ')
        .trim();

const buildProductHaystack = (product: Product) => {
    const claims = product.nutritional_claims?.join(' ') || '';
    const nutritionKeys = product.nutrition_info
        ? Object.entries(product.nutrition_info)
            .map(([key, value]) => `${key} ${value ?? ''}`)
            .join(' ')
        : '';

    return normalizeText(
        [product.product_name, product.brand, claims, nutritionKeys, product.unit]
            .filter(Boolean)
            .join(' ')
    );
};

const buildClaimsHaystack = (product: Product) =>
    normalizeText(product.nutritional_claims?.join(' ') || '');

const findMatchingConfigs = (intolerances: string[]): IntoleranceConfig[] => {
    const matches = new Map<string, IntoleranceConfig>();
    intolerances.forEach((raw) => {
        const normalized = normalizeText(raw);
        INTOLERANCE_CONFIGS.forEach((config) => {
            if (config.synonyms.some((syn) => normalized.includes(normalizeText(syn)))) {
                matches.set(config.id, config);
            }
        });
    });
    return Array.from(matches.values());
};

const filterProductsByIntolerances = (
    products: AggregatedProduct[],
    intolerances: string[]
) => {
    const configs = findMatchingConfigs(intolerances);
    if (configs.length === 0) return products;

    return products.filter((product) => {
        const haystack = buildProductHaystack(product);
        const claims = buildClaimsHaystack(product);

        return configs.every((config) => {
            const hasSafeKeyword = config.safe.some((phrase) => {
                const normalizedPhrase = normalizeText(phrase);
                return (
                    haystack.includes(normalizedPhrase) || claims.includes(normalizedPhrase)
                );
            });

            if (hasSafeKeyword) {
                return true;
            }

            return !config.blocked.some((keyword) => {
                const normalizedKeyword = normalizeText(keyword);
                return normalizedKeyword && haystack.includes(normalizedKeyword);
            });
        });
    });
};

const filterProductsByRelevance = (
    products: AggregatedProduct[],
    query: string
) => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return products;

    const tokens = normalizedQuery
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);

    if (tokens.length === 0) {
        tokens.push(normalizedQuery);
    }

    return products.filter((product) => {
        const haystack = buildProductHaystack(product);
        if (!haystack) return false;

        return tokens.some((token) => haystack.includes(token));
    });
};

// --- Main Logic ---

async function scrapeSingleStore(
    store: NearbyStore,
    query: string,
): Promise<AggregatedProduct[]> {
    const adapter = store.brand ? ADAPTER_MAP[store.brand] : undefined;
    if (!adapter) {
        console.warn(`[Orquestador] No adapter found for brand: ${store.brand}. Skipping.`);
        return [];
    }

    try {
        console.log(`[Orquestador] Scraping ${store.brand} with adapter...`);
        const products = await adapter.scrape(query);
        console.log(`[Orquestador] ${store.brand} devolvió ${products.length} productos brutos.`);
        if (products.length > 0) {
            console.log('[Orquestador] Ejemplos:', products.slice(0, 3).map((p) => p.product_name));
        }

        const supabase = await createClient();
        await persistProducts(products, store.id!, supabase);

        return products.map(p => ({
            ...p,
            store_id: store.id!,
            store_name: store.name,
            store_brand: store.brand,
            distance_meters: store.distance || 0,
            store_lat: store.latitude,
            store_lon: store.longitude,
        }));
    } catch (error) {
        console.error(`[Orquestador] Failed scraping store ${store.name}:`, (error as Error).message);
        return [];
    }
}

export async function searchNearbyProducts(
    userLat: number,
    userLon: number,
    productQuery: string,
    forceRefresh: boolean = false,
    maxStores: number = 3,
    intolerances: string[] = []
): Promise<AggregatedProductResults> {
    const startTime = Date.now();

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

    const nearbyStores = await findNearbyStores(userLat, userLon, 2000);
    console.log(`[Orchestrator] Nearby stores: ${nearbyStores.length}`);
    nearbyStores.slice(0, 5).forEach((store) => {
        console.log('[Orchestrator] Store candidate:', {
            name: store.name,
            brand: store.brand,
            type: store.store_type,
            scrapingEnabled: store.scraping_enabled,
            distance: store.distance,
        });
    });

    const scrapableStores = nearbyStores
        .filter(store => store.brand && ADAPTER_MAP[store.brand])
        .slice(0, maxStores);

    console.log(`[Orchestrator] Found ${scrapableStores.length} scrapable stores.`);

    const CONCURRENCY = 3;
    const allProducts: AggregatedProduct[] = [];

    for (let i = 0; i < scrapableStores.length; i += CONCURRENCY) {
        const batch = scrapableStores.slice(i, i + CONCURRENCY);
        const promises = batch.map(store => scrapeSingleStore(store, productQuery));
        const results = await Promise.allSettled(promises);

        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                allProducts.push(...result.value);
            }
        });
    }

    const relevantProducts = filterProductsByRelevance(allProducts, productQuery);
    if (allProducts.length !== relevantProducts.length) {
        console.log('[Orquestador] Productos filtrados por relevancia:', allProducts.length - relevantProducts.length);
    }
    const personalizedProducts = intolerances.length
        ? filterProductsByIntolerances(relevantProducts, intolerances)
        : relevantProducts;
    if (relevantProducts.length !== personalizedProducts.length) {
        console.log('[Orquestador] Productos filtrados por intolerancias:', relevantProducts.length - personalizedProducts.length);
    }

    const filteredOutCount = Math.max(allProducts.length - relevantProducts.length, 0) +
        Math.max(relevantProducts.length - personalizedProducts.length, 0);

    await cacheResults(userLat, userLon, productQuery, personalizedProducts, scrapableStores.length);

    return {
        products: personalizedProducts,
        stores_searched: scrapableStores.length,
        cache_hit: false,
        search_latency_ms: Date.now() - startTime,
        filtered_out_count: filteredOutCount,
    };
}

async function checkCache(
    lat: number,
    lon: number,
    query: string
): Promise<Omit<AggregatedProductResults, 'cache_hit' | 'search_latency_ms'> | null> {
    try {
        const supabase = await createClient();
        const hash = encodeGeohash(lat, lon, 6);

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
            filtered_out_count: 0,
        };
    } catch (error) {
        console.error('[Cache] Check error:', error);
        return null;
    }
}

async function cacheResults(
    lat: number,
    lon: number,
    query: string,
    products: AggregatedProduct[],
    storesSearched: number
): Promise<void> {
    try {
        const supabase = await createClient();
        const hash = encodeGeohash(lat, lon, 6);
        
        // Si encontramos productos, cacheamos por 24 horas.
        // Si no encontramos nada, solo por 5 minutos para evitar persistir fallos temporales.
        const durationMs = products.length > 0 
            ? 24 * 60 * 60 * 1000 // 24 horas
            : 5 * 60 * 1000;      // 5 minutos

        const expiresAt = new Date(Date.now() + durationMs);

        await supabase.from('product_search_cache').upsert(
            {
                geohash: hash,
                query: query.toLowerCase(),
                results: products,
                result_count: storesSearched,
                expires_at: expiresAt.toISOString(),
            },
            { onConflict: 'geohash,query' }
        );
    } catch (error) {
        console.error('[Cache] Store error:', error);
    }
}

async function persistProducts(
    products: Product[],
    storeId: string,
    supabase: SupabaseClient
): Promise<void> {
    if (products.length === 0) return;
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
            image_url: p.image_url,
            product_url: p.product_url,
        }));

        const { error } = await supabase.from('scraped_products').insert(records);
        if (error) {
            console.error('[DB] Insert error:', error.message);
        }
    } catch (error) {
        console.error('[DB] Persist error:', (error as Error).message);
    }
}
