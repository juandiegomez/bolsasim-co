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

async function createTargetDatabase(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(databaseName)) {
    throw new Error("Invalid database name");
  }
  const admin = createDatabase(
    `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres`,
  );
  try {
    const existing = await admin.db.execute(
      sql`select 1 from pg_database where datname = ${databaseName}`,
    );
    if (existing.rows.length === 0) {
      await admin.db.execute(
        sql`create database ${sql.raw(`"${databaseName}"`)}`,
      );
    }
  } finally {
    await admin.close();
  }
}

async function main() {
  if (command !== "check" && command !== "migrate" && command !== "create")
    throw new Error("Invalid command");
  const environment = getEnvironment();
  if (command === "create") {
    await createTargetDatabase(environment.DATABASE_URL);
    return;
  }
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
