import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createGetPortfolioSnapshot } from "@/application/use-cases/get-portfolio-snapshot";
import { createInitializePortfolio } from "@/application/use-cases/initialize-portfolio";
import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import { getTestDatabaseUrl } from "@/infrastructure/config/env";
import { createDatabase } from "@/infrastructure/database/client";
import { createDrizzlePortfolioRepository } from "@/infrastructure/database/portfolio-repository";
import { createDrizzleBuyPreviewRepository } from "@/infrastructure/database/buy-preview-repository";
import { runMigrations } from "@/infrastructure/database/migrate";
import { asUserId } from "@/domain/ids";
import { Money } from "@/domain/money";
import { asInstrumentId, asPreviewId, asTransactionId } from "@/domain/ids";
import { Quantity } from "@/domain/quantity";
import type { BuyPreview } from "@/domain/buy-preview";

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
      sql`truncate table buy_previews, users, portfolios, transactions`,
    );
  });

  function repository() {
    return createDrizzlePortfolioRepository(database.db);
  }

  function preview(
    portfolioId: string,
    options: { id?: string; expiresAt?: Date; amount?: string } = {},
  ): BuyPreview {
    const amount = options.amount ?? "2000000.00";
    const instrumentId = asInstrumentId("a1b2c3d4-0001-4a01-9a01-000000000001");
    const metadata = {
      providerId: "test",
      mode: "demo" as const,
      retrievedAt: asOf,
      priceBasis: "UNADJUSTED_CLOSE" as const,
      coverageFrom: "2026-09-01",
      coverageTo: "2026-09-09",
      adjustedPricePolicy: "none",
      limitations: [],
    };
    return {
      id: asPreviewId(options.id ?? "b1b2c3d4-0001-4a01-9a01-000000000001"),
      portfolioId: portfolioId as never,
      instrument: {
        id: instrumentId,
        symbol: "TEST",
        name: "Test",
        exchange: "X",
        currency: "COP",
        type: "EQUITY",
        status: "ACTIVE",
      },
      requestedAmount: Money.create(amount, "COP"),
      price: {
        instrumentId,
        sessionDate: "2026-09-09",
        close: "2500.00000000",
        currency: "COP",
        metadata,
      },
      quantity: Quantity.create("800.00000000"),
      grossAmount: Money.create(amount, "COP"),
      remainder: Money.zero("COP"),
      fees: Money.zero("COP"),
      totalDebit: Money.create(amount, "COP"),
      availableCash: initialDeposit,
      createdAt: asOf,
      expiresAt: options.expiresAt ?? new Date("2026-09-09T13:05:00.000Z"),
    };
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
    expect(scales.quantity).toBe("28,8");
  });

  it("PORT-003: confirms once and replays the same idempotency key", async () => {
    const initialized = await repository().initializeForOwner(
      ownerId,
      initialDeposit,
      asOf,
    );
    const previews = createDrizzleBuyPreviewRepository(database.db);
    await previews.create(preview(initialized.portfolioId));
    const input = {
      previewId: asPreviewId("b1b2c3d4-0001-4a01-9a01-000000000001"),
      portfolioId: initialized.portfolioId,
      idempotencyKey: "buy-test-1",
      now: asOf,
      transactionId: asTransactionId("c1b2c3d4-0001-4a01-9a01-000000000001"),
    };
    const first = await previews.confirm(input);
    const second = await previews.confirm({
      ...input,
      transactionId: asTransactionId("d1b2c3d4-0001-4a01-9a01-000000000001"),
    });
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);
  });

  it("PORT-003: rejects an expired preview without writing a BUY", async () => {
    const initialized = await repository().initializeForOwner(
      ownerId,
      initialDeposit,
      asOf,
    );
    const previews = createDrizzleBuyPreviewRepository(database.db);
    await previews.create(
      preview(initialized.portfolioId, {
        expiresAt: new Date("2026-09-09T12:59:59.000Z"),
      }),
    );
    await expect(
      previews.confirm({
        previewId: asPreviewId("b1b2c3d4-0001-4a01-9a01-000000000001"),
        portfolioId: initialized.portfolioId,
        idempotencyKey: "expired",
        now: asOf,
        transactionId: asTransactionId("c1b2c3d4-0001-4a01-9a01-000000000001"),
      }),
    ).rejects.toMatchObject({ code: "PREVIEW_EXPIRED" });
  });

  it("PORT-003: rechecks funds at confirmation time", async () => {
    const initialized = await repository().initializeForOwner(
      ownerId,
      initialDeposit,
      asOf,
    );
    const previews = createDrizzleBuyPreviewRepository(database.db);
    await previews.create(preview(initialized.portfolioId));
    await database.db.execute(
      sql`insert into transactions (id, portfolio_id, type, gross_amount, fees, currency, executed_at, source, created_at) values ('c1b2c3d4-0001-4a01-9a01-000000000001', ${initialized.portfolioId}::uuid, 'BUY', '9000000.00', '0.00', 'COP', ${asOf}, 'USER_SIMULATION', ${asOf})`,
    );
    await expect(
      previews.confirm({
        previewId: asPreviewId("b1b2c3d4-0001-4a01-9a01-000000000001"),
        portfolioId: initialized.portfolioId,
        idempotencyKey: "insufficient",
        now: asOf,
        transactionId: asTransactionId("d1b2c3d4-0001-4a01-9a01-000000000001"),
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });

  it("PORT-003: rejects a different key after confirmation (PREVIEW_ALREADY_USED)", async () => {
    const initialized = await repository().initializeForOwner(
      ownerId,
      initialDeposit,
      asOf,
    );
    const previews = createDrizzleBuyPreviewRepository(database.db);
    await previews.create(preview(initialized.portfolioId));
    const input = {
      previewId: asPreviewId("b1b2c3d4-0001-4a01-9a01-000000000001"),
      portfolioId: initialized.portfolioId,
      now: asOf,
      transactionId: asTransactionId("c1b2c3d4-0001-4a01-9a01-000000000001"),
    };
    await previews.confirm({ ...input, idempotencyKey: "first" });
    await expect(
      previews.confirm({ ...input, idempotencyKey: "other" }),
    ).rejects.toMatchObject({ code: "PREVIEW_ALREADY_USED" });
  });

  it("PORT-003: rejects a foreign key applied to another preview (IDEMPOTENCY_CONFLICT)", async () => {
    const initialized = await repository().initializeForOwner(
      ownerId,
      initialDeposit,
      asOf,
    );
    const previews = createDrizzleBuyPreviewRepository(database.db);
    await previews.create(preview(initialized.portfolioId));
    await previews.confirm({
      previewId: asPreviewId("b1b2c3d4-0001-4a01-9a01-000000000001"),
      portfolioId: initialized.portfolioId,
      idempotencyKey: "first",
      now: asOf,
      transactionId: asTransactionId("c1b2c3d4-0001-4a01-9a01-000000000001"),
    });
    await previews.create(
      preview(initialized.portfolioId, {
        id: "b1b2c3d4-0002-4a01-9a01-000000000001",
      }),
    );
    await expect(
      previews.confirm({
        previewId: asPreviewId("b1b2c3d4-0002-4a01-9a01-000000000001"),
        portfolioId: initialized.portfolioId,
        idempotencyKey: "first",
        now: asOf,
        transactionId: asTransactionId("d1b2c3d4-0001-4a01-9a01-000000000001"),
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("PORT-003: concurrent confirmations cannot create two BUY movements", async () => {
    const initialized = await repository().initializeForOwner(
      ownerId,
      initialDeposit,
      asOf,
    );
    const previews = createDrizzleBuyPreviewRepository(database.db);
    await previews.create(preview(initialized.portfolioId));
    const input = {
      previewId: asPreviewId("b1b2c3d4-0001-4a01-9a01-000000000001"),
      portfolioId: initialized.portfolioId,
      idempotencyKey: "concurrent",
      now: asOf,
    };
    const [first, second] = await Promise.all([
      previews.confirm({
        ...input,
        transactionId: asTransactionId("c1b2c3d4-0001-4a01-9a01-000000000001"),
      }),
      previews.confirm({
        ...input,
        transactionId: asTransactionId("d1b2c3d4-0001-4a01-9a01-000000000001"),
      }),
    ]);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    const count = await database.db.execute(
      sql`select count(*)::int as count from transactions where type = 'BUY'`,
    );
    expect(count.rows[0]?.count).toBe(1);
  });

  it("PED-001: reset archives the current scenario and creates a fresh one", async () => {
    const repo = repository();
    const first = await repo.initializeForOwner(ownerId, initialDeposit, asOf);
    const result = await repo.resetForOwner(
      ownerId,
      initialDeposit,
      new Date("2026-09-10T13:00:00.000Z"),
    );
    expect(result.archived?.portfolioId).toBe(first.portfolioId);
    expect(result.archived?.status).toBe("ARCHIVED");
    expect(result.active.portfolioId).not.toBe(first.portfolioId);
    expect(result.active.ledger).toHaveLength(1);
    await expect(repo.findByOwner(ownerId)).resolves.toMatchObject({
      portfolioId: result.active.portfolioId,
      status: "ACTIVE",
    });
    await expect(repo.listScenarios(ownerId)).resolves.toHaveLength(2);
  });

  it("PED-002: voiding a BUY appends a reversal and rebuilds cash", async () => {
    const repo = repository();
    const initialized = await repo.initializeForOwner(
      ownerId,
      initialDeposit,
      asOf,
    );
    const previews = createDrizzleBuyPreviewRepository(database.db);
    await previews.create(preview(initialized.portfolioId));
    const confirmed = await previews.confirm({
      previewId: asPreviewId("b1b2c3d4-0001-4a01-9a01-000000000001"),
      portfolioId: initialized.portfolioId,
      idempotencyKey: "void-buy",
      now: asOf,
      transactionId: asTransactionId("c1b2c3d4-0001-4a01-9a01-000000000001"),
    });
    const after = await repo.voidBuy(
      ownerId,
      confirmed.transaction.id,
      new Date("2026-09-10T13:00:00.000Z"),
    );
    expect(after.ledger.at(-1)?.type).toBe("VOID_BUY");
    expect((await useCases().snapshot.execute()).cash.toString()).toBe(
      "10000000.00",
    );
    await expect(
      repo.voidBuy(ownerId, confirmed.transaction.id, asOf),
    ).rejects.toMatchObject({ code: "BUY_ALREADY_VOIDED" });
  });
});
