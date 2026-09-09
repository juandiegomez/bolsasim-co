import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createGetPortfolioSnapshot } from "@/application/use-cases/get-portfolio-snapshot";
import { createInitializePortfolio } from "@/application/use-cases/initialize-portfolio";
import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import { getTestDatabaseUrl } from "@/infrastructure/config/env";
import { createDatabase } from "@/infrastructure/database/client";
import { createDrizzlePortfolioRepository } from "@/infrastructure/database/portfolio-repository";
import { runMigrations } from "@/infrastructure/database/migrate";
import { asUserId } from "@/domain/ids";
import { Money } from "@/domain/money";

const ownerId = asUserId("00000000-0000-0000-0000-000000000001");
const initialDeposit = Money.create("10000000.00", "COP");
const asOf = new Date("2026-09-09T13:00:00.000Z");
const clock: Clock = { now: () => asOf };
const currentUser: CurrentUserProvider = { currentUserId: () => ownerId };

describe("PORT-001/PORT-002: PostgreSQL ledger repository", () => {
  let database: ReturnType<typeof createDatabase>;
  beforeAll(async () => {
    database = createDatabase(getTestDatabaseUrl(process.env));
    await runMigrations(database.db);
  });
  afterAll(async () => {
    if (database) await database.close();
  });
  beforeEach(async () => {
    await database.db.execute(
      sql`truncate table users, portfolios, transactions`,
    );
  });

  function repository() {
    return createDrizzlePortfolioRepository(database.db);
  }

  function useCases() {
    const repo = repository();
    return {
      initialize: createInitializePortfolio({
        repository: repo,
        currentUser,
        clock,
        initialDeposit,
      }),
      snapshot: createGetPortfolioSnapshot({
        repository: repo,
        currentUser,
        clock,
        initialDeposit,
      }),
    };
  }

  it("PORT-001: repeated initialization leaves exactly one deposit", async () => {
    const { initialize } = useCases();
    const first = await initialize.execute();
    const second = await initialize.execute();
    expect(second.portfolioId).toBe(first.portfolioId);
    const deposits = await database.db.execute(
      sql`select count(*)::int as count from transactions where type = 'INITIAL_DEPOSIT'`,
    );
    expect(deposits.rows[0]?.count).toBe(1);
  });

  it("PORT-001/FIN-001: the deposit persists as an exact numeric string", async () => {
    await useCases().initialize.execute();
    const rows = await database.db.execute(
      sql`select gross_amount, fees, currency, source from transactions where type = 'INITIAL_DEPOSIT' limit 1`,
    );
    expect(rows.rows[0]?.gross_amount).toBe("10000000.00");
    expect(rows.rows[0]?.fees).toBe("0.00");
    expect(rows.rows[0]?.currency).toBe("COP");
    expect(rows.rows[0]?.source).toBe("SYSTEM_INITIALIZATION");
  });

  it("PORT-001: the unique index rejects a second deposit at the database level", async () => {
    await useCases().initialize.execute();
    let violation = "";
    try {
      await database.db.execute(
        sql`insert into transactions (portfolio_id, type, gross_amount, fees, currency, executed_at, source, created_at)
            select portfolio_id, 'INITIAL_DEPOSIT', '10000000.00', '0.00', 'COP', executed_at, source, created_at
            from transactions where type = 'INITIAL_DEPOSIT' limit 1`,
      );
    } catch (error) {
      const cause = (error as { cause?: unknown }).cause;
      violation = `${String(error)} ${cause ? String(cause) : ""}`;
    }
    expect(violation).toContain("transactions_initial_deposit_unique");
  });

  it("PORT-002: repeated snapshots derive the same exact balance", async () => {
    const { initialize, snapshot } = useCases();
    await initialize.execute();
    const first = await snapshot.execute();
    const second = await snapshot.execute();
    expect(first.cash.toString()).toBe("10000000.00");
    expect(second.portfolioId).toBe(first.portfolioId);
    expect(second.cash.equals(first.cash)).toBe(true);
  });

  it("PORT-002: a corrupted ledger fails explicitly instead of returning a partial view", async () => {
    const { initialize, snapshot } = useCases();
    await initialize.execute();
    const portfolios = await database.db.execute(
      sql`select id from portfolios limit 1`,
    );
    const portfolioId = portfolios.rows[0]?.id as string;
    await database.db.execute(
      sql`insert into transactions (portfolio_id, type, gross_amount, fees, currency, executed_at, source, created_at)
          values (${portfolioId}::uuid, 'BUY', '1000.00', '0.00', 'COP', now(), 'USER_SIMULATION', now())`,
    );
    await expect(snapshot.execute()).rejects.toMatchObject({
      code: "CORRUPT_LEDGER",
    });
  });

  it("FIN-002: the schema enforces the documented decimal scales", async () => {
    const columns = await database.db.execute(
      sql`select column_name, numeric_precision, numeric_scale
          from information_schema.columns
          where table_name = 'transactions'
            and column_name in ('gross_amount', 'quantity')`,
    );
    const scales = Object.fromEntries(
      columns.rows.map((row) => [
        row.column_name as string,
        `${row.numeric_precision},${row.numeric_scale}`,
      ]),
    );
    expect(scales.gross_amount).toBe("24,2");
    expect(scales.quantity).toBe("24,8");
  });
});
