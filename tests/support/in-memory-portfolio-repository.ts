import type {
  InitializedPortfolio,
  PortfolioRepository,
} from "@/application/ports/portfolio-repository";
import {
  asPortfolioId,
  asTransactionId,
  type PortfolioId,
  type UserId,
} from "@/domain/ids";
import type { Money } from "@/domain/money";
import { createInitialDeposit, type Transaction } from "@/domain/transaction";

// Test double for PORT-001/PORT-002: reproduces the unique-index semantics
// (one portfolio per owner, one initial deposit per portfolio) without a
// database. PostgreSQL itself is exercised by the integration tests.
export function createInMemoryPortfolioRepository(): PortfolioRepository {
  const portfoliosByOwner = new Map<string, PortfolioId>();
  const ledgers = new Map<PortfolioId, Transaction[]>();

  function initializedFor(portfolioId: PortfolioId): InitializedPortfolio {
    const ledger = ledgers.get(portfolioId) ?? [];
    return { portfolioId, ledger };
  }

  return {
    async initializeForOwner(
      ownerId: UserId,
      deposit: Money,
      executedAt: Date,
    ): Promise<InitializedPortfolio> {
      let portfolioId = portfoliosByOwner.get(ownerId);
      if (!portfolioId) {
        portfolioId = asPortfolioId(crypto.randomUUID());
        portfoliosByOwner.set(ownerId, portfolioId);
        ledgers.set(portfolioId, []);
      }
      const ledger = ledgers.get(portfolioId)!;
      if (!ledger.some((entry) => entry.type === "INITIAL_DEPOSIT")) {
        ledger.push(
          createInitialDeposit({
            transactionId: asTransactionId(crypto.randomUUID()),
            portfolioId,
            deposit,
            executedAt,
            createdAt: executedAt,
          }),
        );
      }
      return initializedFor(portfolioId);
    },
    async findByOwner(ownerId: UserId): Promise<InitializedPortfolio | null> {
      const portfolioId = portfoliosByOwner.get(ownerId);
      return portfolioId ? initializedFor(portfolioId) : null;
    },
  };
}
