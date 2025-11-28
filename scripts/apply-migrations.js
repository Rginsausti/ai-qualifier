const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

const migrationFiles = process.argv.slice(2);

async function main() {
  if (!migrationFiles.length) {
    console.error("Usage: node scripts/apply-migrations.js <path-to-sql> [more.sql...]");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("DATABASE_URL o POSTGRES_URL no están definidos en .env.local");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Conexión establecida, aplicando migraciones...");

    for (const relative of migrationFiles) {
      const sqlPath = path.resolve(relative);
      const sql = fs.readFileSync(sqlPath, "utf8");
      console.log(`→ Ejecutando ${path.basename(sqlPath)}...`);
      await client.query(sql);
      console.log(`✔ ${path.basename(sqlPath)} aplicada`);
    }

    console.log("Todas las migraciones se ejecutaron correctamente.");
  } catch (error) {
    console.error("Error ejecutando migraciones:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
