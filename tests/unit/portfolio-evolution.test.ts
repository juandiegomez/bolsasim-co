import { describe, expect, it } from "vitest";
import { projectPortfolioEvolution } from "@/domain/portfolio-evolution";
import { Money } from "@/domain/money";
import { createInitialDeposit } from "@/domain/transaction";
import { createBuy, createVoidBuy } from "@/domain/transaction";
import { asInstrumentId, asPortfolioId, asTransactionId } from "@/domain/ids";
import { Quantity } from "@/domain/quantity";
import { UnitPrice } from "@/domain/unit-price";

describe("PORT-005: daily portfolio evolution", () => {
  it("carries the latest prior close and exposes its session date", () => {
    const at = new Date("2026-08-03T12:00:00.000Z");
    const ledger = [
      createInitialDeposit({
        transactionId: asTransactionId("a1b2c3d4-0001-4a01-9a01-000000000001"),
        portfolioId: asPortfolioId("b1b2c3d4-0001-4a01-9a01-000000000001"),
        deposit: Money.create("10000000.00", "COP"),
        executedAt: at,
        createdAt: at,
      }),
    ];
    const result = projectPortfolioEvolution({
      dates: ["2026-08-03", "2026-08-04"],
      ledger,
      initialDeposit: Money.create("10000000.00", "COP"),
      prices: new Map(),
    });
    expect(result.map((point) => point.totalValue?.toString())).toEqual([
      "10000000.00",
      "10000000.00",
    ]);
  });

  it("PED-002: includes a BUY before its void date and excludes it from that date", () => {
    const portfolioId = asPortfolioId("b1b2c3d4-0001-4a01-9a01-000000000001");
    const instrumentId = asInstrumentId("a1b2c3d4-0001-4a01-9a01-000000000001");
    const depositAt = new Date("2026-08-01T12:00:00.000Z");
    const buyAt = new Date("2026-08-02T12:00:00.000Z");
    const voidAt = new Date("2026-08-04T12:00:00.000Z");
    const buy = createBuy({
      transactionId: asTransactionId("c1b2c3d4-0001-4a01-9a01-000000000001"),
      portfolioId,
      instrumentId,
      quantity: Quantity.create("2.00000000"),
      unitPrice: UnitPrice.create("25000.00000000", "COP"),
      grossAmount: Money.create("50000.00", "COP"),
      fees: Money.zero("COP"),
      executedAt: buyAt,
      marketSessionDate: "2026-08-02",
      marketData: {
        providerId: "test",
        mode: "demo",
        retrievedAt: buyAt,
        priceBasis: "UNADJUSTED_CLOSE",
        coverageFrom: "2026-08-01",
        coverageTo: "2026-08-04",
        adjustedPricePolicy: "none",
        limitations: [],
      },
      idempotencyKey: "evolution-void",
      ledgerSequence: 1,
    });
    const ledger = [
      createInitialDeposit({
        transactionId: asTransactionId("a1b2c3d4-0001-4a01-9a01-000000000001"),
        portfolioId,
        deposit: Money.create("10000000.00", "COP"),
        executedAt: depositAt,
        createdAt: depositAt,
        ledgerSequence: 0,
      }),
      buy,
      createVoidBuy({
        transactionId: asTransactionId("d1b2c3d4-0001-4a01-9a01-000000000001"),
        portfolioId,
        reversalOfTransactionId: buy.id,
        currency: "COP",
        executedAt: voidAt,
        ledgerSequence: 2,
      }),
    ];
    const result = projectPortfolioEvolution({
      dates: ["2026-08-03", "2026-08-04"],
      ledger,
      initialDeposit: Money.create("10000000.00", "COP"),
      prices: new Map([
        [
          instrumentId,
          [{ sessionDate: "2026-08-03", close: "25000.00000000" }],
        ],
      ]),
    });
    expect(result.map((point) => point.cash.toString())).toEqual([
      "9950000.00",
      "10000000.00",
    ]);
  });
});
