import { describe, expect, it } from "vitest";
import { createInitializePortfolio } from "@/application/use-cases/initialize-portfolio";
import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import { asUserId } from "@/domain/ids";
import { Money } from "@/domain/money";
import { createInMemoryPortfolioRepository } from "../support/in-memory-portfolio-repository";

const ownerId = asUserId("00000000-0000-0000-0000-000000000001");
const initialDeposit = Money.create("10000000.00", "COP");
const asOf = new Date("2026-09-09T13:00:00.000Z");
const clock: Clock = { now: () => asOf };
const currentUser: CurrentUserProvider = { currentUserId: () => ownerId };

describe("PORT-001: the initial deposit happens exactly once per portfolio", () => {
  it("creates the portfolio with one deposit and derives the snapshot", async () => {
    const repository = createInMemoryPortfolioRepository();
    const useCase = createInitializePortfolio({
      repository,
      currentUser,
      clock,
      initialDeposit,
    });
    const first = await useCase.execute();
    expect(first.portfolioId).toBeTruthy();
    expect(first.cash.toString()).toBe("10000000.00");
    expect(first.investedCost.toString()).toBe("0.00");
    expect(first.valuationStatus).toBe("COMPLETE");
    expect(first.asOf.toISOString()).toBe(asOf.toISOString());
    expect(first.positions).toEqual([]);
  });
  it("repeated initialization keeps a single deposit and the same portfolio", async () => {
    const repository = createInMemoryPortfolioRepository();
    const useCase = createInitializePortfolio({
      repository,
      currentUser,
      clock,
      initialDeposit,
    });
    const first = await useCase.execute();
    const second = await useCase.execute();
    expect(second.portfolioId).toBe(first.portfolioId);
    expect(second.cash.toString()).toBe("10000000.00");
    const current = await repository.findByOwner(ownerId);
    expect(current?.ledger).toHaveLength(1);
    expect(current?.ledger[0]?.type).toBe("INITIAL_DEPOSIT");
  });
});
