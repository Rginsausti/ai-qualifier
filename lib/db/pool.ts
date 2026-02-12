import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

declare global {
  var __eatappDbPool: Pool | undefined;
}

function createPool() {
  if (!connectionString) {
    throw new Error("DATABASE_URL o POSTGRES_URL no está definido");
  }

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

export function getDbPool(): Pool {
  if (!global.__eatappDbPool) {
    global.__eatappDbPool = createPool();
  }
  return global.__eatappDbPool;
}
