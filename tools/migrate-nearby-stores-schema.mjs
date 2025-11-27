import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
    await client.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE public.nearby_stores
                ADD COLUMN IF NOT EXISTS store_type TEXT,
                ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
                ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
                ADD COLUMN IF NOT EXISTS website_url TEXT,
                ADD COLUMN IF NOT EXISTS scraping_enabled BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        `);

        await client.query(`
            UPDATE public.nearby_stores
            SET latitude = lat::double precision
            WHERE latitude IS NULL AND lat IS NOT NULL;
        `);

        await client.query(`
            UPDATE public.nearby_stores
            SET longitude = lon::double precision
            WHERE longitude IS NULL AND lon IS NOT NULL;
        `);

        await client.query(`
            ALTER TABLE public.nearby_stores
                ALTER COLUMN latitude SET NOT NULL,
                ALTER COLUMN longitude SET NOT NULL,
                ALTER COLUMN scraping_enabled SET DEFAULT TRUE;
        `);

        await client.query('COMMIT');
        console.log('✅ nearby_stores schema migration complete.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

main();
