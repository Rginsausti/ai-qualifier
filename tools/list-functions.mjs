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
        const res = await client.query(`
            SELECT proname, pg_get_function_identity_arguments(oid) AS args
            FROM pg_proc
            WHERE proname = 'calculate_distance';
        `);
        console.table(res.rows);
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
