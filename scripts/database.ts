import nextEnv from "@next/env";
import { sql } from "drizzle-orm";
import {
  ConfigurationError,
  getEnvironment,
} from "../src/infrastructure/config/env";
import { createDatabase } from "../src/infrastructure/database/client";
import { runMigrations } from "../src/infrastructure/database/migrate";
import { createLogger } from "../src/infrastructure/logging/logger";

nextEnv.loadEnvConfig(process.cwd());
const logger = createLogger();
const command = process.argv[2];

async function main() {
  if (command !== "check" && command !== "migrate")
    throw new Error("Invalid command");
  const environment = getEnvironment();
  const database = createDatabase(environment.DATABASE_URL);
  try {
    if (command === "migrate") await runMigrations(database.db);
    else await database.db.execute(sql`select 1 as connected`);
    logger.log({ level: "info", event: `database.${command}.completed` });
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  logger.log({
    level: "error",
    event: "database.command.failed",
    category:
      error instanceof ConfigurationError ? "configuration" : "persistence",
    errorCode:
      error instanceof ConfigurationError
        ? error.code
        : command === "migrate"
          ? "MIGRATION_FAILED"
          : "DATABASE_UNAVAILABLE",
  });
  process.exitCode = 1;
});
