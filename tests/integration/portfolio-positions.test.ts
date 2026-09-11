import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import { createGetPortfolioSnapshot } from "@/application/use-cases/get-portfolio-snapshot";
import { asUserId } from "@/domain/ids";
import { Money } from "@/domain/money";
import { getTestDatabaseUrl } from "@/infrastructure/config/env";
import { createDatabase } from "@/infrastructure/database/client";
import { createDrizzlePortfolioRepository } from "@/infrastructure/database/portfolio-repository";
import { runMigrations } from "@/infrastructure/database/migrate";
import { createPortfolioPositionsHandlers } from "@/infrastructure/http/portfolio-positions-handlers";
import { serializePosition } from "@/infrastructure/http/serialize-portfolio";
import { createFileDatasetMarketDataProvider } from "@/infrastructure/market/file-dataset-provider";

const ownerId = asUserId("00000000-0000-0000-0000-000000000001");
const initialDeposit = Money.create("10000000.00", "COP");
const asOf = new Date("2026-09-10T13:00:00.000Z");
const clock: Clock = { now: () => asOf };
const currentUser: CurrentUserProvider = {
  currentUserId: () => ownerId,
};
const DEMO1 = "a1b2c3d4-0001-4a01-9a01-000000000001";
const UNKNOWN_INSTRUMENT = "a1b2c3d4-0009-4a09-9a09-000000000009";

const marketData = {
  providerId: "bolsasim-demo",
  mode: "demo",
  retrievedAt: asOf.toISOString(),
  priceBasis: "UNADJUSTED_CLOSE",
  coverageFrom: "2026-08-03",
  coverageTo: "2026-08-28",
  adjustedPricePolicy: "Sin ajustes.",
  limitations: ["Datos demo reproducibles."],
};

describe("PORT-004/PORT-005: dedicated positions route", () => {
  let database: ReturnType<typeof createDatabase>;
  let provider: Awaited<ReturnType<typeof createFileDatasetMarketDataProvider>>;

  beforeAll(async () => {
    database = createDatabase(getTestDatabaseUrl(process.env));
    await runMigrations(database.db);
    provider = await createFileDatasetMarketDataProvider({
      datasetPath: "datasets/demo",
      manifestPath: "datasets/demo/manifest.json",
      clock,
    });
  });

  beforeEach(async () => {
    await database.db.execute(
      sql`truncate table buy_previews, transactions, portfolios, users`,
    );
  });

  afterAll(async () => {
    if (database) await database.close();
  });

  async function initialize() {
    const repository = createDrizzlePortfolioRepository(database.db);
    return repository.initializeForOwner(ownerId, initialDeposit, asOf);
  }

  function positionsHandler() {
    const repository = createDrizzlePortfolioRepository(database.db);
    const snapshot = createGetPortfolioSnapshot({
      repository,
      currentUser,
      clock,
      initialDeposit,
      provider,
    });
    return {
      handler: createPortfolioPositionsHandlers(snapshot, { log: () => {} }),
      snapshot,
    };
  }

  async function insertBuy(
    portfolioId: string,
    instrumentId: string,
    persistedMarketData: object | null = marketData,
  ) {
    await database.db.execute(sql`
      insert into transactions (
        id, portfolio_id, type, instrument_id, quantity, unit_price,
        gross_amount, fees, currency, executed_at, market_session_date,
        market_data, source, idempotency_key, created_at
      ) values (
        ${randomUUID()}::uuid,
        ${portfolioId}::uuid,
        'BUY',
        ${instrumentId}::uuid,
        '1.00000000',
        '100.00000000',
        '100.00',
        '0.00',
        'COP',
        ${asOf},
        '2026-09-09',
        ${persistedMarketData ? JSON.stringify(persistedMarketData) : null}::jsonb,
        'USER_SIMULATION',
        ${`positions-${randomUUID()}`},
        ${asOf}
      )
    `);
  }

  function request() {
    return new Request("http://localhost/api/v1/portfolio/positions", {
      headers: { "X-Request-Id": "integration-positions" },
    });
  }

  it("PORT-004: returns an empty list for an initialized portfolio", async () => {
    await initialize();
    const { handler } = positionsHandler();
    const response = await handler.positions(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(response.headers.get("x-request-id")).toBe("integration-positions");
  });

  it("PORT-004/MDATA-001: returns the same valued projection as the snapshot", async () => {
    const initialized = await initialize();
    await insertBuy(initialized.portfolioId, DEMO1);
    await insertBuy(initialized.portfolioId, DEMO1);
    const { handler, snapshot } = positionsHandler();
    const expected = await snapshot.execute();
    const response = await handler.positions(request());
    const body = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toEqual(expected.positions.map(serializePosition));
    expect(body.items[0]).toMatchObject({
      quantity: "2.00000000",
      valuationStatus: "VALUED",
      price: { sessionDate: "2026-08-28" },
      marketValue: { amount: "240.00", currency: "COP" },
    });
  });

  it("PORT-004/MDATA-002: reports missing market data without zero valuation", async () => {
    const initialized = await initialize();
    await insertBuy(initialized.portfolioId, UNKNOWN_INSTRUMENT);
    const { handler } = positionsHandler();
    const response = await handler.positions(request());
    const body = (await response.json()) as {
      items: {
        valuationStatus: string;
        price: unknown;
        marketValue: unknown;
        pnl: unknown;
        instrument: { status: string };
      }[];
    };

    expect(response.status).toBe(200);
    expect(body.items[0]).toMatchObject({
      valuationStatus: "PRICE_UNAVAILABLE",
      price: null,
      marketValue: null,
      pnl: null,
      instrument: { status: "UNAVAILABLE" },
    });
  });

  it("SEC-001/OBS-001: rejects corrupt persisted data as a Problem", async () => {
    const initialized = await initialize();
    await insertBuy(initialized.portfolioId, DEMO1, null);
    const { handler } = positionsHandler();
    const response = await handler.positions(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      code: "CORRUPT_LEDGER",
      requestId: "integration-positions",
    });
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
  });
});
