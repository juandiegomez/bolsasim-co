import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { createLogger } from "@/infrastructure/logging/logger";

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 5000,
    query_timeout: 6000,
  });
  pool.on("error", () =>
    createLogger().log({
      level: "error",
      event: "database.pool_error",
      errorCode: "DATABASE_UNAVAILABLE",
      category: "persistence",
    }),
  );
  return { db: drizzle(pool), close: () => pool.end() };
}
