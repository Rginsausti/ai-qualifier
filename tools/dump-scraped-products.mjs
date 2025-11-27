import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const limit = parseInt(process.argv[2] ?? '10', 10);

async function main() {
    const { data, error } = await supabase
        .from('scraped_products')
        .select('product_name, brand, price_current, store_id, scraped_at')
        .order('scraped_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching scraped products:', error.message);
        process.exit(1);
    }

    if (!data?.length) {
        console.log('No scraped products found.');
        return;
    }

    console.table(data);
}

main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
