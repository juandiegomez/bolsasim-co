import { describe, expect, it } from "vitest";
import { asInstrumentId, asPortfolioId, asTransactionId } from "@/domain/ids";
import { projectPositions } from "@/domain/position-projector";
import { Money } from "@/domain/money";
import { Quantity } from "@/domain/quantity";
import { UnitPrice } from "@/domain/unit-price";
import { createBuy } from "@/domain/transaction";

describe("PORT-004: position valuation", () => {
  it("values a derived position without converting financial values to number", () => {
    const id = asInstrumentId("a1b2c3d4-0001-4a01-9a01-000000000001");
    const at = new Date("2026-09-09T13:00:00.000Z");
    const metadata = {
      providerId: "test",
      mode: "demo" as const,
      retrievedAt: at,
      priceBasis: "UNADJUSTED_CLOSE" as const,
      coverageFrom: null,
      coverageTo: null,
      adjustedPricePolicy: "none",
      limitations: [],
    };
    const buy = createBuy({
      transactionId: asTransactionId("b1b2c3d4-0001-4a01-9a01-000000000001"),
      portfolioId: asPortfolioId("c1b2c3d4-0001-4a01-9a01-000000000001"),
      instrumentId: id,
      quantity: Quantity.create("800.00000000"),
      unitPrice: UnitPrice.create("2500.00000000", "COP"),
      grossAmount: Money.create("2000000.00", "COP"),
      fees: Money.zero("COP"),
      executedAt: at,
      marketSessionDate: "2026-09-09",
      marketData: metadata,
      idempotencyKey: "test",
    });
    const positions = projectPositions(
      [buy],
      new Map([
        [
          id,
          {
            instrument: {
              id,
              symbol: "TEST",
              name: "Test",
              exchange: "X",
              currency: "COP",
              type: "EQUITY",
              status: "ACTIVE",
            },
            mode: "demo",
            price: {
              instrumentId: id,
              sessionDate: "2026-09-10",
              close: "3000.00000000",
              currency: "COP",
              metadata,
            },
          },
        ],
      ]),
    );
    expect(positions[0]?.marketValue?.toString()).toBe("2400000.00");
    expect(positions[0]?.pnl?.toString()).toBe("400000.00");
    expect(positions[0]?.returnPct).toBe("20.00");
  });
});
