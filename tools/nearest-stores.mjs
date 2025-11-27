import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const lat = parseFloat(process.argv[2] ?? '-32.9582817');
const lon = parseFloat(process.argv[3] ?? '-60.6750367');
const limit = parseInt(process.argv[4] ?? '20', 10);

async function main() {
    await client.connect();
    try {
        const result = await client.query(
            `SELECT id, name, brand, store_type, scraping_enabled,
                    earth_distance(ll_to_earth($1::double precision, $2::double precision),
                                   ll_to_earth(latitude, longitude)) AS distance_m
             FROM nearby_stores
             ORDER BY distance_m ASC
             LIMIT $3;`,
            [lat, lon, limit]
        );
        console.table(result.rows);
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
