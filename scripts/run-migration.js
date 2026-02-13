const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

const MIGRATIONS_DIR = path.join(__dirname, "../db/migrations");
const MIGRATION_FILE_REGEX = /^\d+_.*\.sql$/;

const arg = process.argv[2];

const printUsage = () => {
  console.log("Usage:");
  console.log("  node scripts/run-migration.js <migration-number>");
  console.log("  node scripts/run-migration.js <migration-filename.sql>");
  console.log("  node scripts/run-migration.js --all");
  console.log("Examples:");
  console.log("  node scripts/run-migration.js 015");
  console.log("  node scripts/run-migration.js 15");
  console.log("  node scripts/run-migration.js 015_add_client_message_id_to_chat_messages.sql");
};

const loadMigrationFiles = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => MIGRATION_FILE_REGEX.test(name))
    .sort((a, b) => a.localeCompare(b));
};

const normalizeMigrationNumber = (value) => {
  const onlyDigits = (value || "").replace(/\D/g, "");
  if (!onlyDigits) return "";
  return onlyDigits.padStart(3, "0");
};

const resolveTargetMigrations = (files, targetArg) => {
  if (!targetArg) {
    throw new Error("Missing migration target argument.");
  }

  if (targetArg === "--all") {
    return files;
  }

  if (targetArg.endsWith(".sql")) {
    const exact = files.find((name) => name === targetArg);
    if (!exact) {
      throw new Error(`Migration file not found: ${targetArg}`);
    }
    return [exact];
  }

  const number = normalizeMigrationNumber(targetArg);
  if (!number) {
    throw new Error(`Invalid migration target: ${targetArg}`);
  }

  const matches = files.filter((name) => name.startsWith(`${number}_`));
  if (matches.length === 0) {
    throw new Error(`Migration not found for number: ${number}`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple migrations found for number ${number}: ${matches.join(", ")}`);
  }

  return matches;
};

async function runMigration() {
  try {
    const files = loadMigrationFiles();
    const targets = resolveTargetMigrations(files, arg);
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!dbUrl) {
      throw new Error("DATABASE_URL or POSTGRES_URL not found in .env.local");
    }

    console.log("Starting migration run...");
    console.log(`Targets: ${targets.join(", ")}`);

    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      console.log("Connected to database.");

      for (const fileName of targets) {
        const migrationPath = path.join(MIGRATIONS_DIR, fileName);
        const sql = fs.readFileSync(migrationPath, "utf8");
        console.log(`Executing ${fileName}...`);
        await client.query(sql);
        console.log(`Applied ${fileName}`);
      }

      console.log("Migration run completed successfully.");
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error("Migration failed:", err.message || err);
    printUsage();
    process.exit(1);
  }
}

runMigration();
