import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    console.error('   Add them to your .env.local file before running this script.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const args = process.argv.slice(2);
const centerLat = parseFloat(args[0] ?? '-34.6037');
const centerLon = parseFloat(args[1] ?? '-58.3816');
const radius = parseInt(args[2] ?? '2000', 10);

const categories = [
    { tag: 'shop', value: 'supermarket', storeType: 'supermarket', label: 'Supermercado', scrapingEnabled: true },
    { tag: 'shop', value: 'convenience', storeType: 'convenience', label: 'Almacén', scrapingEnabled: true },
    { tag: 'shop', value: 'greengrocer', storeType: 'produce', label: 'Verdulería', scrapingEnabled: false },
    { tag: 'shop', value: 'butcher', storeType: 'butcher', label: 'Carnicería', scrapingEnabled: false },
    { tag: 'shop', value: 'seafood', storeType: 'fishmonger', label: 'Pescadería', scrapingEnabled: false },
    { tag: 'shop', value: 'bakery', storeType: 'bakery', label: 'Panadería', scrapingEnabled: false },
    { tag: 'shop', value: 'deli', storeType: 'deli', label: 'Fiambres', scrapingEnabled: false },
    { tag: 'amenity', value: 'cafe', storeType: 'cafe', label: 'Cafetería', scrapingEnabled: false },
    { tag: 'amenity', value: 'restaurant', storeType: 'restaurant', label: 'Restaurante', scrapingEnabled: false }
];

const BRAND_MAPPINGS = {
    'coto': 'COTO',
    'coto digital': 'COTO',
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
    'walmart': 'WALMART',
    'la gallega': 'LA GALLEGA',
    'la reina': 'LA REINA',
    'maxiconsumo': 'MAXICONSUMO'
};

const SUPPORTED_BRANDS = new Set(['COTO', 'CARREFOUR', 'JUMBO', 'VEA', 'DISCO']);

function buildOverpassQuery() {
    const lines = categories.map((category) => {
        const filter = `[${category.tag}="${category.value}"]`;
        return [
            `  node${filter}(around:${radius},${centerLat},${centerLon});`,
            `  way${filter}(around:${radius},${centerLat},${centerLon});`,
            `  relation${filter}(around:${radius},${centerLat},${centerLon});`
        ].join('\n');
    }).join('\n');

    return `\n[out:json][timeout:25];\n(\n${lines}\n);\nout center;\n`;
}

function resolveCategory(tags = {}) {
    const tagEntries = [
        ['shop', tags.shop],
        ['amenity', tags.amenity]
    ];

    for (const [tag, value] of tagEntries) {
        if (!value) continue;
        const category = categories.find((c) => c.tag === tag && c.value === value);
        if (category) {
            return category;
        }
    }

    return { storeType: tags.shop || tags.amenity || 'other', label: 'Comercio', scrapingEnabled: false };
}

function buildAddress(tags = {}) {
    const parts = [
        tags['addr:street'],
        tags['addr:housenumber'],
        tags['addr:unit'],
        tags['addr:city']
    ].filter(Boolean);

    return parts.join(' ');
}

function sanitizeUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `https://${url}`;
}

function resolveBrand(tags = {}) {
    const raw = tags.brand || tags.operator || tags.name;
    if (!raw) return { brand: null, canonical: null };

    const sanitized = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    for (const [pattern, canonical] of Object.entries(BRAND_MAPPINGS)) {
        if (sanitized.includes(pattern)) {
            return { brand: canonical, canonical };
        }
    }

    return { brand: raw.trim(), canonical: null };
}

function resolveCoordinates(element) {
    if (element.type === 'node') {
        return { lat: element.lat, lon: element.lon };
    }

    if (element.center) {
        return { lat: element.center.lat, lon: element.center.lon };
    }

    return null;
}

function buildStoreRecord(element) {
    const category = resolveCategory(element.tags);
    const coords = resolveCoordinates(element);

    if (!coords) return null;

    const name = element.tags?.name || `${category.label} ${element.id}`;
    const street = element.tags?.['addr:street'];
    const houseNumber = element.tags?.['addr:housenumber'];
    const city = element.tags?.['addr:city'];
    const formattedAddress = buildAddress(element.tags);
    const address = formattedAddress
        ? {
            formatted: formattedAddress,
            street: street || null,
            number: houseNumber || null,
            city: city || null,
        }
        : null;
    const website = sanitizeUrl(element.tags?.website || element.tags?.['contact:website']);

    const { brand, canonical } = resolveBrand(element.tags);
    const scrapingSupported = category.scrapingEnabled && Boolean(canonical && SUPPORTED_BRANDS.has(canonical));

    return {
        osm_id: element.id,
        name,
        brand,
        store_type: category.storeType,
        lat: coords.lat,
        lon: coords.lon,
        latitude: coords.lat,
        longitude: coords.lon,
        address,
        website_url: website,
        scraping_enabled: scrapingSupported,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

async function fetchPlaces() {
    const query = buildOverpassQuery();
    console.log('🛰️  Querying Overpass API...');

    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query
    });

    if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.elements || [];
}

async function seedStores() {
    console.log(`📍 Center: (${centerLat.toFixed(4)}, ${centerLon.toFixed(4)}) – Radius: ${radius}m`);
    const elements = await fetchPlaces();
    console.log(`📦 Received ${elements.length} raw places.`);

    const seen = new Set();
    const stores = [];

    for (const element of elements) {
        if (!element.tags) continue;
        const record = buildStoreRecord(element);
        if (!record) continue;
        if (seen.has(record.osm_id)) continue;
        seen.add(record.osm_id);
        stores.push(record);
    }

    if (stores.length === 0) {
        console.log('ℹ️  No stores to insert.');
        return;
    }

    console.log(`📝 Prepared ${stores.length} store records. Upserting into Supabase...`);

    const { data, error } = await supabase
        .from('nearby_stores')
        .upsert(stores, { onConflict: 'osm_id' })
        .select('id, name, brand, store_type, scraping_enabled');

    if (error) {
        console.error('❌ Supabase error:', error.message);
        process.exit(1);
    }

    const enabled = data.filter((store) => store.scraping_enabled).length;
    console.log(`✅ Upsert complete. Total stored: ${data.length}. Scraping enabled: ${enabled}.`);
    console.table(data.slice(0, Math.min(5, data.length)));
}

seedStores().catch((error) => {
    console.error('🚨 Seed failed:', error.message);
    process.exit(1);
});
