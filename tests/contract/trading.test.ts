import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import { createConfirmBuyPreview } from "@/application/use-cases/confirm-buy-preview";
import { createCreateBuyPreview } from "@/application/use-cases/create-buy-preview";
import { createGetPortfolioEvolution } from "@/application/use-cases/get-portfolio-evolution";
import { createGetPortfolioSnapshot } from "@/application/use-cases/get-portfolio-snapshot";
import { createInitializePortfolio } from "@/application/use-cases/initialize-portfolio";
import { createListPortfolioTransactions } from "@/application/use-cases/list-portfolio-transactions";
import { getTestDatabaseUrl } from "@/infrastructure/config/env";
import { createDatabase } from "@/infrastructure/database/client";
import { createDrizzleBuyPreviewRepository } from "@/infrastructure/database/buy-preview-repository";
import { createDrizzlePortfolioRepository } from "@/infrastructure/database/portfolio-repository";
import { runMigrations } from "@/infrastructure/database/migrate";
import { asPreviewId, asTransactionId, asUserId } from "@/domain/ids";
import { Money } from "@/domain/money";
import { createPortfolioQueryHandlers } from "@/infrastructure/http/portfolio-queries-handlers";
import { createTradingHandlers } from "@/infrastructure/http/trading-handlers";
import { createFileDatasetMarketDataProvider } from "@/infrastructure/market/file-dataset-provider";

const document = parse(readFileSync("docs/api/openapi.yaml", "utf8"));
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);

function compile(name: string) {
  return ajv.compile({
    ...document,
    allOf: [{ $ref: `#/components/schemas/${name}` }],
  });
}

const buyPreviewValidator = compile("BuyPreview");
const confirmationValidator = compile("BuyConfirmation");
const transactionValidator = compile("Transaction");
const evolutionPointValidator = compile("PortfolioEvolutionPoint");
const problem = compile("Problem");

const DEMO1 = "a1b2c3d4-0001-4a01-9a01-000000000001";
const DEMOUSD = "a1b2c3d4-0004-4a04-9a04-000000000004";
const clock: Clock = { now: () => new Date("2026-09-10T13:00:00.000Z") };
const currentUser: CurrentUserProvider = {
  currentUserId: () => asUserId("00000000-0000-0000-0000-000000000001"),
};
const initialDeposit = Money.create("10000000.00", "COP");

describe("PORT-003/PORT-005: trading and portfolio queries contract", () => {
  let database: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    database = createDatabase(getTestDatabaseUrl(process.env));
    await runMigrations(database.db);
  });
  beforeEach(async () => {
    await database.db.execute(
      sql`truncate table buy_previews, transactions, portfolios, users`,
    );
  });
  afterAll(async () => {
    if (database) await database.close();
  });

  async function wiring() {
    const portfolios = createDrizzlePortfolioRepository(database.db);
    const previews = createDrizzleBuyPreviewRepository(database.db);
    const provider = await createFileDatasetMarketDataProvider({
      datasetPath: "datasets/demo",
      manifestPath: "datasets/demo/manifest.json",
      clock,
    });
    const initialize = createInitializePortfolio({
      repository: portfolios,
      currentUser,
      clock,
      initialDeposit,
    });
    await initialize.execute();
    const trading = createTradingHandlers(
      {
        preview: createCreateBuyPreview({
          repository: portfolios,
          previews,
          provider,
          currentUser,
          clock,
          initialDeposit,
          createPreviewId: () => asPreviewId(randomUUID()),
        }),
        confirm: createConfirmBuyPreview({
          previews,
          portfolios,
          currentUser,
          clock,
          createTransactionId: () => asTransactionId(randomUUID()),
        }),
        snapshot: createGetPortfolioSnapshot({
          repository: portfolios,
          currentUser,
          clock,
          initialDeposit,
          provider,
        }),
      },
      { log: () => {} },
    );
    const queries = createPortfolioQueryHandlers(
      {
        evolution: createGetPortfolioEvolution({
          repository: portfolios,
          provider,
          currentUser,
          initialDeposit,
        }),
        transactions: createListPortfolioTransactions({
          repository: portfolios,
          currentUser,
        }),
      },
      { log: () => {} },
    );
    return { trading, queries };
  }

  async function createPreview(
    trading: Awaited<ReturnType<typeof wiring>>["trading"],
    amount = "2000000.00",
    instrumentId = DEMO1,
  ) {
    const response = await trading.preview(
      new Request("http://localhost/api/v1/buy-previews", {
        method: "POST",
        body: JSON.stringify({
          instrumentId,
          amount: { amount, currency: "COP" },
        }),
      }),
    );
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  async function confirm(
    trading: Awaited<ReturnType<typeof wiring>>["trading"],
    previewId: string,
    key = "contract-key-1",
  ) {
    const response = await trading.confirm(
      new Request(`http://localhost/api/v1/buy-previews/${previewId}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": key },
      }),
      previewId,
    );
    return { status: response.status, body: await response.json() };
  }

  it("POST /buy-previews returns a valid preview with zero fees (FIN-003)", async () => {
    const { trading } = await wiring();
    const result = await createPreview(trading);
    expect(result.status).toBe(201);
    const preview = result.body as unknown as {
      id: string;
      quantity: string;
      grossAmount: { amount: string; currency: string };
      fees: { amount: string; currency: string };
      totalDebit: { amount: string; currency: string };
      availableCash: { amount: string; currency: string };
      instrument: { dataMode: string };
    };
    expect(
      buyPreviewValidator(result.body),
      JSON.stringify(buyPreviewValidator.errors),
    ).toBe(true);
    expect(preview.quantity).toBe("16666.66666666");
    expect(preview.grossAmount).toEqual({
      amount: "2000000.00",
      currency: "COP",
    });
    expect(preview.fees).toEqual({ amount: "0.00", currency: "COP" });
    expect(preview.totalDebit).toEqual({
      amount: "2000000.00",
      currency: "COP",
    });
    expect(preview.availableCash).toEqual({
      amount: "10000000.00",
      currency: "COP",
    });
    expect(preview.instrument.dataMode).toBe("demo");
  });

  it("confirm registers the exact PORT-003 case and the replay returns 200", async () => {
    const { trading } = await wiring();
    const preview = await createPreview(trading);
    const first = await confirm(trading, preview.body.id as string);
    expect(first.status).toBe(201);
    expect(
      confirmationValidator(first.body),
      JSON.stringify(confirmationValidator.errors),
    ).toBe(true);
    expect(first.body.transaction.type).toBe("BUY");
    expect(first.body.transaction.quantity).toBe("16666.66666666");
    expect(first.body.transaction.fees).toEqual({
      amount: "0.00",
      currency: "COP",
    });
    expect(first.body.portfolio.cash).toEqual({
      amount: "8000000.00",
      currency: "COP",
    });
    const position = (
      first.body.portfolio.positions as {
        instrument: { symbol: string };
        quantity: string;
        valuationStatus: string;
      }[]
    )[0];
    expect(position?.quantity).toBe("16666.66666666");
    expect(position?.valuationStatus).toBe("VALUED");
    const replay = await confirm(trading, preview.body.id as string);
    expect(replay.status).toBe(200);
    expect(replay.body.transaction.id).toBe(first.body.transaction.id);
    const movements = await (
      await wiring()
    ).queries.transactions(
      new Request("http://localhost/api/v1/portfolio/transactions"),
    );
    const ledger = await movements.json();
    expect(ledger.items).toHaveLength(2);
  });

  it("rejects a consumed preview with a different key (PREVIEW_ALREADY_USED)", async () => {
    const { trading } = await wiring();
    const preview = await createPreview(trading);
    await confirm(trading, preview.body.id as string, "key-a");
    const reused = await confirm(trading, preview.body.id as string, "key-b");
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe("PREVIEW_ALREADY_USED");
    expect(problem(reused.body)).toBe(true);
  });

  it("rejects a foreign key applied to another preview (IDEMPOTENCY_CONFLICT)", async () => {
    const { trading } = await wiring();
    const first = await createPreview(trading);
    await confirm(trading, first.body.id as string, "key-one");
    const second = await createPreview(trading);
    const conflict = await confirm(
      trading,
      second.body.id as string,
      "key-one",
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(problem(conflict.body)).toBe(true);
  });

  it("fails explicitly on insufficient funds and non-tradable instruments", async () => {
    const { trading } = await wiring();
    const excessive = await createPreview(trading, "11000000.00");
    expect(excessive.status).toBe(409);
    expect(excessive.body.code).toBe("INSUFFICIENT_FUNDS");
    expect(problem(excessive.body)).toBe(true);
    const usd = await createPreview(trading, "1000.00", DEMOUSD);
    expect(usd.status).toBe(422);
    expect(usd.body.code).toBe("INSTRUMENT_NOT_TRADABLE");
  });

  it("rejects forged or incomplete requests on the server", async () => {
    const { trading } = await wiring();
    const forged = await trading.preview(
      new Request("http://localhost/api/v1/buy-previews", {
        method: "POST",
        body: JSON.stringify({
          instrumentId: DEMO1,
          amount: { amount: "1000.00", currency: "COP" },
          quantity: "999",
          unitPrice: "1.00",
        }),
      }),
    );
    expect(forged.status).toBe(400);
    expect((await forged.json()).code).toBe("INVALID_QUERY");
    const preview = await createPreview(trading);
    const keyless = await trading.confirm(
      new Request(
        `http://localhost/api/v1/buy-previews/${preview.body.id}/confirm`,
        { method: "POST" },
      ),
      preview.body.id as string,
    );
    expect(keyless.status).toBe(400);
    expect((await keyless.json()).code).toBe("INVALID_QUERY");
  });

  it("GET /portfolio/evolution validates points and never shows incomplete values as zero", async () => {
    const { trading, queries } = await wiring();
    const preview = await createPreview(trading);
    await confirm(trading, preview.body.id as string);
    const response = await queries.evolution(
      new Request(
        "http://localhost/api/v1/portfolio/evolution?from=2026-08-20&to=2026-09-10",
      ),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Record<string, unknown>[];
    };
    expect(body.items.length).toBeGreaterThan(0);
    for (const point of body.items) {
      expect(
        evolutionPointValidator(point),
        JSON.stringify(evolutionPointValidator.errors),
      ).toBe(true);
      if (point.valuationStatus === "INCOMPLETE") {
        expect(point.totalValue).toBeNull();
      }
    }
    const dragged = body.items.find((point) => point.date === "2026-09-10");
    expect(dragged).toBeDefined();
    expect(dragged?.priceSessionDates).toEqual({
      [DEMO1]: "2026-08-28",
    });
  });

  it("GET /portfolio/transactions lists the ledger newest first with valid shapes", async () => {
    const { trading, queries } = await wiring();
    const preview = await createPreview(trading);
    await confirm(trading, preview.body.id as string);
    const response = await queries.transactions(
      new Request("http://localhost/api/v1/portfolio/transactions"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Record<string, unknown>[];
    };
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.type).toBe("BUY");
    for (const item of body.items) {
      expect(
        transactionValidator(item),
        JSON.stringify(transactionValidator.errors),
      ).toBe(true);
    }
  });
});
