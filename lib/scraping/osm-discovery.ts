"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Represents a store discovered from OpenStreetMap
 */
export type NearbyStore = {
    id?: string;
    osm_id: number;
    name: string;
    brand?: string;
    store_type:
        | 'supermarket'
        | 'convenience'
        | 'health_food'
        | 'produce'
        | 'butcher'
        | 'fishmonger'
        | 'bakery'
        | 'deli'
        | 'restaurant'
        | 'cafe';
    latitude: number;
    longitude: number;
    address?: string | Record<string, unknown> | null;
    website_url?: string;
    distance?: number; // meters from user
    scraping_enabled?: boolean;
};

/**
 * Brand normalization map (OSM tag → canonical brand)
 */
const BRAND_MAPPINGS: Record<string, string> = {
    'coto': 'COTO',
    'coto digital': 'COTO',
    'supermercados coto': 'COTO',
    'carrefour': 'CARREFOUR',
    'carrefour express': 'CARREFOUR',
    'carrefour market': 'CARREFOUR',
    'express carrefour': 'CARREFOUR',
    'jumbo': 'JUMBO',
    'vea': 'VEA',
    'disco': 'DISCO',
    'dia': 'DIA',
    'dia%': 'DIA',
    'dia express': 'DIA',
};

const SUPPORTED_BRANDS = new Set(['COTO', 'CARREFOUR', 'JUMBO', 'VEA', 'DISCO']);

/**
 * Website URL map (brand → base URL)
 */
const BRAND_URLS: Record<string, string> = {
    'COTO': 'https://www.cotodigital3.com.ar',
    'CARREFOUR': 'https://www.carrefour.com.ar',
    'JUMBO': 'https://www.jumbo.com.ar',
    'VEA': 'https://www.vea.com.ar',
    'DISCO': 'https://www.disco.com.ar',
    'DIA': 'https://diaonline.supermercadosdia.com.ar',
};

/**
 * Normalizes brand name from OSM tags
 */
function normalizeBrand(osmBrand?: string): string | undefined {
    if (!osmBrand) return undefined;

    const sanitized = osmBrand
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    for (const [pattern, canonical] of Object.entries(BRAND_MAPPINGS)) {
        if (sanitized.includes(pattern)) {
            return canonical;
        }
    }
    return undefined;
}

const STORE_TYPES: NearbyStore['store_type'][] = [
    'supermarket',
    'convenience',
    'health_food',
    'produce',
    'butcher',
    'fishmonger',
    'bakery',
    'deli',
    'restaurant',
    'cafe',
];

function normalizeStoreType(value?: string | null): NearbyStore['store_type'] {
    if (value && STORE_TYPES.includes(value as NearbyStore['store_type'])) {
        return value as NearbyStore['store_type'];
    }
    return 'supermarket';
}

/**
 * Finds nearby stores using OpenStreetMap Overpass API
 * @param lat - User latitude
 * @param lon - User longitude
 * @param radiusMeters - Search radius in meters (default: 2000m = 2km)
 * @returns Array of nearby stores sorted by distance
 */
export async function findNearbyStores(
    lat: number,
    lon: number,
    radiusMeters: number = 2000
): Promise<NearbyStore[]> {
    try {
        // Build Overpass QL query
        const query = `
            [out:json][timeout:25];
            (
                // Supermercados y autoservicios
                node["shop"="supermarket"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="supermarket"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="supermarket"](around:${radiusMeters}, ${lat}, ${lon});

                // Minimercados y kioscos grandes
                node["shop"="convenience"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="convenience"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="convenience"](around:${radiusMeters}, ${lat}, ${lon});

                // Dietéticas / comida saludable
                node["shop"="health_food"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="health_food"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="health_food"](around:${radiusMeters}, ${lat}, ${lon});

                // Panaderías
                node["shop"="bakery"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="bakery"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="bakery"](around:${radiusMeters}, ${lat}, ${lon});

                // Verdulerías / fruterías
                node["shop"="greengrocer"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="greengrocer"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="greengrocer"](around:${radiusMeters}, ${lat}, ${lon});

                // Carnicerías y pescaderías
                node["shop"="butcher"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="butcher"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="butcher"](around:${radiusMeters}, ${lat}, ${lon});

                node["shop"="seafood"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="seafood"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="seafood"](around:${radiusMeters}, ${lat}, ${lon});

                // Rotiserías / delicatessen
                node["shop"="deli"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="deli"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="deli"](around:${radiusMeters}, ${lat}, ${lon});

                // Restaurantes y cafés
                node["amenity"="restaurant"](around:${radiusMeters}, ${lat}, ${lon});
                way["amenity"="restaurant"](around:${radiusMeters}, ${lat}, ${lon});
                relation["amenity"="restaurant"](around:${radiusMeters}, ${lat}, ${lon});

                node["amenity"="cafe"](around:${radiusMeters}, ${lat}, ${lon});
                way["amenity"="cafe"](around:${radiusMeters}, ${lat}, ${lon});
                relation["amenity"="cafe"](around:${radiusMeters}, ${lat}, ${lon});
            );
            out center;
        `;

        // Query Overpass API
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (!response.ok) {
            console.error('Overpass API error:', response.status);
            return [];
        }

        const data = await response.json();
        const elements = data.elements || [];

        // Process and deduplicate stores
        const storesMap = new Map<number, NearbyStore>();

        for (const element of elements) {
            const tags = element.tags || {};

            // Get coordinates (center for ways, direct for nodes)
            const storeLat = element.center?.lat || element.lat;
            const storeLon = element.center?.lon || element.lon;

            if (!storeLat || !storeLon) continue;

            // Determine store type
            let storeType: NearbyStore['store_type'] = 'supermarket';
            if (tags.shop === 'convenience') storeType = 'convenience';
            if (tags.shop === 'health_food') storeType = 'health_food';

            // Normalize brand
            const brand = normalizeBrand(tags.brand || tags.name);

            // Calculate distance from user
            const distance = calculateDistance(lat, lon, storeLat, storeLon);

            const scrapingEnabled = Boolean(brand && SUPPORTED_BRANDS.has(brand));

            const store: NearbyStore = {
                osm_id: element.id,
                name: tags.name || 'Supermercado sin nombre',
                brand,
                store_type: storeType,
                latitude: storeLat,
                longitude: storeLon,
                address: tags['addr:street'] ?
                    `${tags['addr:street']} ${tags['addr:housenumber'] || ''}`.trim() :
                    undefined,
                website_url: brand ? BRAND_URLS[brand] : tags.website,
                distance,
                scraping_enabled: scrapingEnabled,
            };

            // Deduplicate by OSM ID
            if (!storesMap.has(element.id)) {
                storesMap.set(element.id, store);
            }
        }

        // Convert to array and sort by distance
        let stores = Array.from(storesMap.values()).sort((a, b) =>
            (a.distance || 0) - (b.distance || 0)
        );

        // Persist to database for caching
        await persistStores(stores);
        await attachStoreMetadata(stores);

        // Ensure we include previously descubiertos desde Supabase
        stores = await mergeWithDatabaseStores(stores, lat, lon, radiusMeters);

        return stores;
    } catch (error) {
        console.error('Error finding nearby stores:', error);
        return [];
    }
}

/**
 * Calculates distance between two coordinates in meters
 * Uses Haversine formula
 */
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
}

/**
 * Persists stores to database (upsert)
 */
async function persistStores(stores: NearbyStore[]): Promise<void> {
    try {
        const supabase = await createClient();

        for (const store of stores) {
            await supabase.from('nearby_stores').upsert(
                {
                    osm_id: store.osm_id,
                    name: store.name,
                    brand: store.brand,
                    store_type: store.store_type,
                    latitude: store.latitude,
                    longitude: store.longitude,
                    address: store.address,
                    website_url: store.website_url,
                    scraping_enabled: store.scraping_enabled ?? false,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'osm_id' }
            );
        }
    } catch (error) {
        console.error('Error persisting stores:', error);
    }
}

async function attachStoreMetadata(stores: NearbyStore[]): Promise<void> {
    if (stores.length === 0) return;

    try {
        const supabase = await createClient();
        const osmIds = stores.map((store) => store.osm_id);
        const { data, error } = await supabase
            .from('nearby_stores')
            .select('id, osm_id, brand, scraping_enabled')
            .in('osm_id', osmIds);

        if (error || !data) {
            if (error) {
                console.error('Error loading store metadata:', error);
            }
            return;
        }

        const lookup = new Map<number, { id: string; brand: string | null; scraping_enabled: boolean | null }>();
        data.forEach((row) => {
            lookup.set(row.osm_id, {
                id: row.id,
                brand: row.brand,
                scraping_enabled: row.scraping_enabled,
            });
        });

        stores.forEach((store) => {
            const details = lookup.get(store.osm_id);
            if (!details) return;
            store.id = details.id;
            if (!store.brand && details.brand) {
                store.brand = details.brand;
            }
            if (typeof store.scraping_enabled !== 'boolean' && typeof details.scraping_enabled === 'boolean') {
                store.scraping_enabled = details.scraping_enabled;
            }
        });
    } catch (error) {
        console.error('Error hydrating store metadata:', error);
    }
}

async function mergeWithDatabaseStores(
    stores: NearbyStore[],
    lat: number,
    lon: number,
    radiusMeters: number
): Promise<NearbyStore[]> {
    const supabase = await createClient();
    const latDelta = radiusMeters / 111320;
    const lonDenominator = Math.max(Math.cos((lat * Math.PI) / 180), 0.0001);
    const lonDelta = radiusMeters / (111320 * lonDenominator);

    const { data, error } = await supabase
        .from('nearby_stores')
        .select('id, osm_id, name, brand, store_type, latitude, longitude, address, website_url, scraping_enabled')
        .eq('scraping_enabled', true)
        .gte('latitude', lat - latDelta)
        .lte('latitude', lat + latDelta)
        .gte('longitude', lon - lonDelta)
        .lte('longitude', lon + lonDelta);

    if (error || !data) {
        if (error) {
            console.error('Error merging stores from Supabase:', error);
        }
        return stores;
    }

    const storeMap = new Map<number, NearbyStore>();
    stores.forEach((store) => {
        storeMap.set(store.osm_id, store);
    });

    data.forEach((row) => {
        if (!row.osm_id || !row.latitude || !row.longitude) {
            return;
        }

        const distance = calculateDistance(lat, lon, row.latitude, row.longitude);
        const existing = storeMap.get(row.osm_id);

        if (existing) {
            existing.id = existing.id || row.id;
            existing.brand = existing.brand || row.brand || undefined;
            existing.store_type = existing.store_type || normalizeStoreType(row.store_type as string | null);
            existing.latitude = row.latitude;
            existing.longitude = row.longitude;
            existing.address = existing.address || (row.address as NearbyStore['address']);
            existing.website_url = existing.website_url || row.website_url || undefined;
            existing.scraping_enabled = typeof existing.scraping_enabled === 'boolean'
                ? existing.scraping_enabled
                : Boolean(row.scraping_enabled);
            existing.distance = existing.distance ?? distance;
            return;
        }

        storeMap.set(row.osm_id, {
            id: row.id,
            osm_id: row.osm_id,
            name: row.name || 'Supermercado sin nombre',
            brand: row.brand || undefined,
            store_type: normalizeStoreType(row.store_type as string | null),
            latitude: row.latitude,
            longitude: row.longitude,
            address: row.address as NearbyStore['address'],
            website_url: row.website_url || undefined,
            distance,
            scraping_enabled: Boolean(row.scraping_enabled),
        });
    });

    return Array.from(storeMap.values()).sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

/**
 * Gets stores from database by brand
 */
export async function getStoresByBrand(brand: string): Promise<NearbyStore[]> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('nearby_stores')
            .select('*')
            .eq('brand', brand)
            .eq('scraping_enabled', true);

        if (error) {
            console.error('Error fetching stores:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error getting stores by brand:', error);
        return [];
    }
}
