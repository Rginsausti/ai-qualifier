import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

const brand = process.argv[2] ?? 'CARREFOUR';

const lat = parseFloat(process.argv[3] ?? '-32.9582817');
const lon = parseFloat(process.argv[4] ?? '-60.6750367');
const radius = parseInt(process.argv[5] ?? '2000', 10);

const latDelta = radius / 111320;
const lonDenominator = Math.max(Math.cos((lat * Math.PI) / 180), 0.0001);
const lonDelta = radius / (111320 * lonDenominator);

const { data, error } = await supabase
    .from('nearby_stores')
    .select('id, osm_id, name, brand, scraping_enabled, latitude, longitude')
    .eq('brand', brand)
    .gte('latitude', lat - latDelta)
    .lte('latitude', lat + latDelta)
    .gte('longitude', lon - lonDelta)
    .lte('longitude', lon + lonDelta);

if (error) {
    console.error('Error fetching store:', error.message);
    process.exit(1);
}

console.table(data);
