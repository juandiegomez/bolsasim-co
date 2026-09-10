import nextEnv from "@next/env";
import { sql } from "drizzle-orm";
import { createDatabase } from "@/infrastructure/database/client";
import { runMigrations } from "@/infrastructure/database/migrate";

nextEnv.loadEnvConfig(process.cwd());

// E2E_DATABASE_URL must point at a dedicated database: the suite migrates it
// and truncates the business tables so every run starts deterministic. When
// unset (fresh CI database), the setup is a no-op.
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) return;
  const database = createDatabase(url);
  try {
    await runMigrations(database.db);
    await database.db.execute(
      sql`truncate table buy_previews, transactions, portfolios, users`,
    );
  } finally {
    await database.close();
  }
}
