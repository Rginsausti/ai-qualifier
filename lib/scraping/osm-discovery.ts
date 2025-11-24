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
    store_type: 'supermarket' | 'convenience' | 'health_food';
    latitude: number;
    longitude: number;
    address?: string;
    website_url?: string;
    distance?: number; // meters from user
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
    'jumbo': 'JUMBO',
    'vea': 'VEA',
    'disco': 'DISCO',
    'dia': 'DIA',
    'día%': 'DIA',
};

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

    const lowercased = osmBrand.toLowerCase().trim();
    for (const [pattern, canonical] of Object.entries(BRAND_MAPPINGS)) {
        if (lowercased.includes(pattern)) {
            return canonical;
        }
    }
    return undefined;
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
                node["shop"="supermarket"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="supermarket"](around:${radiusMeters}, ${lat}, ${lon});
                relation["shop"="supermarket"](around:${radiusMeters}, ${lat}, ${lon});
                node["shop"="convenience"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="convenience"](around:${radiusMeters}, ${lat}, ${lon});
                node["shop"="health_food"](around:${radiusMeters}, ${lat}, ${lon});
                way["shop"="health_food"](around:${radiusMeters}, ${lat}, ${lon});
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
            };

            // Deduplicate by OSM ID
            if (!storesMap.has(element.id)) {
                storesMap.set(element.id, store);
            }
        }

        // Convert to array and sort by distance
        const stores = Array.from(storesMap.values()).sort((a, b) =>
            (a.distance || 0) - (b.distance || 0)
        );

        // Persist to database for caching
        await persistStores(stores);

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
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'osm_id' }
            );
        }
    } catch (error) {
        console.error('Error persisting stores:', error);
    }
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
