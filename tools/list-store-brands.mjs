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
        const result = await client.query(`
            SELECT brand, COUNT(*) as count
            FROM public.nearby_stores
            WHERE brand IS NOT NULL
            GROUP BY brand
            ORDER BY count DESC
            LIMIT 20;
        `);
        console.table(result.rows);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
