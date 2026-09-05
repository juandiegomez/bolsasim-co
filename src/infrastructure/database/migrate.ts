import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { createDatabase } from "./client";

export async function runMigrations(
  database: ReturnType<typeof createDatabase>["db"],
) {
  await migrate(database, { migrationsFolder: "drizzle" });
}
