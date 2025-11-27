import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        await client.connect();
        const result = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'nearby_stores'
            ORDER BY ordinal_position;
        `);
        console.table(result.rows);
    } finally {
        await client.end();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
