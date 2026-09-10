import { describe, expect, it } from "vitest";
import { projectPortfolioEvolution } from "@/domain/portfolio-evolution";
import { Money } from "@/domain/money";
import { createInitialDeposit } from "@/domain/transaction";
import { asPortfolioId, asTransactionId } from "@/domain/ids";

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
});
