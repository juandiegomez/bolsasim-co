import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { asInstrumentId, asPortfolioId, asTransactionId } from "@/domain/ids";
import type { MarketDataMetadata } from "@/domain/market";
import { Money } from "@/domain/money";
import { projectLedger } from "@/domain/portfolio-projector";
import { Quantity } from "@/domain/quantity";
import {
  createBuy,
  createInitialDeposit,
  type Transaction,
} from "@/domain/transaction";
import { UnitPrice } from "@/domain/unit-price";

const depositAmount = Money.create("10000000.00", "COP");
const executedAt = new Date("2026-09-09T13:00:00.000Z");

function depositTransaction(at: Date, id = randomUUID()): Transaction {
  return createInitialDeposit({
    transactionId: asTransactionId(id),
    portfolioId: asPortfolioId(randomUUID()),
    deposit: depositAmount,
    executedAt: at,
    createdAt: at,
  });
}

function buyTransaction(): Transaction {
  return {
    id: asTransactionId(randomUUID()),
    portfolioId: asPortfolioId(randomUUID()),
    type: "BUY",
    instrumentId: null,
    quantity: null,
    unitPrice: null,
    grossAmount: Money.create("1000.00", "COP"),
    fees: Money.zero("COP"),
    currency: "COP",
    executedAt,
    marketSessionDate: "2026-09-09",
    marketData: null,
    source: "USER_SIMULATION",
    idempotencyKey: null,
    createdAt: executedAt,
    ledgerSequence: 0,
  };
}

function corruptCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as { code?: string }).code ?? "no-code";
  }
  return "no-error";
}

describe("PORT-002: the ledger projects the portfolio deterministically", () => {
  it("replays a single initial deposit into an exact cash balance", () => {
    const projection = projectLedger(
      [depositTransaction(executedAt)],
      depositAmount,
    );
    expect(projection.cash.toString()).toBe("10000000.00");
    expect(projection.investedCost.toString()).toBe("0.00");
    expect(projection.valuationStatus).toBe("COMPLETE");
  });
  it("PORT-003: a valid BUY debits cash and accumulates invested cost", () => {
    const metadata: MarketDataMetadata = {
      providerId: "bolsasim-demo",
      mode: "demo",
      retrievedAt: executedAt,
      priceBasis: "UNADJUSTED_CLOSE",
      coverageFrom: "2026-08-03",
      coverageTo: "2026-08-28",
      adjustedPricePolicy: "Sin ajustes.",
      limitations: ["Datos demo."],
    };
    const at = new Date("2026-09-10T13:00:00.000Z");
    const buy = createBuy({
      transactionId: asTransactionId(randomUUID()),
      portfolioId: asPortfolioId(randomUUID()),
      instrumentId: asInstrumentId("a1b2c3d4-0001-4a01-9a01-000000000001"),
      quantity: Quantity.create("2.00000000"),
      unitPrice: UnitPrice.create("25000.00000000", "COP"),
      grossAmount: Money.create("50000.00", "COP"),
      fees: Money.zero("COP"),
      executedAt: at,
      marketSessionDate: "2026-08-28",
      marketData: metadata,
      idempotencyKey: "key-1",
    });
    const projection = projectLedger(
      [depositTransaction(executedAt), buy],
      depositAmount,
    );
    expect(projection.cash.toString()).toBe("9950000.00");
    expect(projection.investedCost.toString()).toBe("50000.00");
  });
  it("fails explicitly when the deposit repeats", () => {
    expect(
      corruptCode(() =>
        projectLedger(
          [
            depositTransaction(executedAt),
            depositTransaction(executedAt, randomUUID()),
          ],
          depositAmount,
        ),
      ),
    ).toBe("CORRUPT_LEDGER");
  });
  it("fails explicitly on an out-of-order or unknown sequence", () => {
    expect(
      corruptCode(() =>
        projectLedger(
          [buyTransaction(), depositTransaction(executedAt)],
          depositAmount,
        ),
      ),
    ).toBe("CORRUPT_LEDGER");
  });
  it("fails explicitly when the portfolio has no initial deposit", () => {
    expect(corruptCode(() => projectLedger([], depositAmount))).toBe(
      "CORRUPT_LEDGER",
    );
  });
  it("fails explicitly when the deposit amount differs from the configured one", () => {
    expect(
      corruptCode(() =>
        projectLedger(
          [
            createInitialDeposit({
              transactionId: asTransactionId(randomUUID()),
              portfolioId: asPortfolioId(randomUUID()),
              deposit: Money.create("9999999.00", "COP"),
              executedAt,
              createdAt: executedAt,
            }),
          ],
          depositAmount,
        ),
      ),
    ).toBe("CORRUPT_LEDGER");
  });
});
