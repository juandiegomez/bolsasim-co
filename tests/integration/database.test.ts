import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTestDatabaseUrl } from "@/infrastructure/config/env";
import { createDatabase } from "@/infrastructure/database/client";
import { runMigrations } from "@/infrastructure/database/migrate";

describe("FND-001: real PostgreSQL connection and migrations", () => {
  let database: ReturnType<typeof createDatabase>;
  beforeAll(() => {
    database = createDatabase(getTestDatabaseUrl(process.env));
  });
  afterAll(async () => {
    if (database) await database.close();
  });

  it("connects using the approved driver/ORM", async () => {
    const result = await database.db.execute(
      sql`select 1 as connected, version() as version`,
    );
    expect(result.rows[0]?.connected).toBe(1);
    expect(result.rows[0]?.version).toMatch(/^PostgreSQL 17\./);
  });
  it("applies the bootstrap once and reapplying preserves the journal", async () => {
    await runMigrations(database.db);
    const before = await database.db.execute(
      sql`select id, hash, created_at from drizzle.__drizzle_migrations order by id`,
    );
    await runMigrations(database.db);
    const after = await database.db.execute(
      sql`select id, hash, created_at from drizzle.__drizzle_migrations order by id`,
    );
    expect(before.rows.length).toBeGreaterThanOrEqual(1);
    expect(after.rows).toEqual(before.rows);
    const tables = await database.db.execute(
      sql`select tablename from pg_tables where schemaname = 'public' order by tablename`,
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      "portfolios",
      "transactions",
      "users",
    ]);
  });
  it("FIN-001 partial: numeric round-trip remains an exact string", async () => {
    const result = await database.db.execute(
      sql`select ${"1234567890123456789012.34"}::numeric(24,2) as amount`,
    );
    expect(result.rows[0]?.amount).toBe("1234567890123456789012.34");
  });
});
