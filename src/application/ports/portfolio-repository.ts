import type { Money } from "@/domain/money";
import type { PortfolioId, UserId } from "@/domain/ids";
import type { Transaction } from "@/domain/transaction";

export interface InitializedPortfolio {
  readonly portfolioId: PortfolioId;
  readonly ledger: readonly Transaction[];
}

// Domain § Puertos: idempotent initialization, ledger reading and atomic
// append live behind this port; projections stay outside persistence.
export interface PortfolioRepository {
  initializeForOwner(
    ownerId: UserId,
    deposit: Money,
    executedAt: Date,
  ): Promise<InitializedPortfolio>;
  findByOwner(ownerId: UserId): Promise<InitializedPortfolio | null>;
}
