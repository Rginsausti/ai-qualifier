const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: '.env.local' });

async function runMigration() {
    console.log('Starting migration...');

    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!dbUrl) {
        console.error('Error: DATABASE_URL or POSTGRES_URL not found in .env.local');
        console.log('Please add your connection string to .env.local');
        process.exit(1);
    }

    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false } // Required for Supabase
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const migrationPath = path.join(__dirname, '../db/migrations/008_create_scraped_products.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration 008...');
        await client.query(sql);
        console.log('Migration executed successfully!');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
