import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { asPortfolioId, asTransactionId } from "@/domain/ids";
import { Money } from "@/domain/money";
import { projectLedger } from "@/domain/portfolio-projector";
import { createInitialDeposit, type Transaction } from "@/domain/transaction";

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
    source: "USER_SIMULATION",
    idempotencyKey: null,
    createdAt: executedAt,
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
