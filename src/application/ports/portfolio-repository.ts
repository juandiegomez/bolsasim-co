import type { Money } from "@/domain/money";
import type { PortfolioId, UserId } from "@/domain/ids";
import type { Transaction } from "@/domain/transaction";

export type ScenarioStatus = "ACTIVE" | "ARCHIVED";

export interface InitializedPortfolio {
  readonly portfolioId: PortfolioId;
  readonly ledger: readonly Transaction[];
  readonly label: string;
  readonly status: ScenarioStatus;
  readonly createdAt: Date;
  readonly archivedAt: Date | null;
}

export interface ScenarioSummary {
  readonly portfolioId: PortfolioId;
  readonly label: string;
  readonly status: ScenarioStatus;
  readonly createdAt: Date;
  readonly archivedAt: Date | null;
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
  listScenarios(ownerId: UserId): Promise<readonly ScenarioSummary[]>;
  resetForOwner(
    ownerId: UserId,
    deposit: Money,
    executedAt: Date,
  ): Promise<{
    readonly archived: InitializedPortfolio | null;
    readonly active: InitializedPortfolio;
  }>;
  voidBuy(
    ownerId: UserId,
    transactionId: import("@/domain/ids").TransactionId,
    executedAt: Date,
  ): Promise<InitializedPortfolio>;
}
