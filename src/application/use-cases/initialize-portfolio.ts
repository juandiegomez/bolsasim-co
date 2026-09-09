import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { PortfolioRepository } from "@/application/ports/portfolio-repository";
import type { Money } from "@/domain/money";
import {
  buildPortfolioSnapshot,
  type PortfolioSnapshot,
} from "@/domain/portfolio";
import { projectLedger } from "@/domain/portfolio-projector";
import type { InitializedPortfolio } from "@/application/ports/portfolio-repository";

export interface PortfolioProjectionDependencies {
  readonly repository: PortfolioRepository;
  readonly currentUser: CurrentUserProvider;
  readonly clock: Clock;
  readonly initialDeposit: Money;
}

function projectInitializedPortfolio(
  initialized: InitializedPortfolio,
  asOf: Date,
  initialDeposit: Money,
): PortfolioSnapshot {
  const projection = projectLedger(initialized.ledger, initialDeposit);
  return buildPortfolioSnapshot({
    portfolioId: initialized.portfolioId,
    asOf,
    projection,
    initialDeposit,
  });
}

// PORT-001: the initial deposit happens exactly once per portfolio; repeated
// calls return the existing portfolio with its single deposit.
export function createInitializePortfolio(
  dependencies: PortfolioProjectionDependencies,
) {
  return {
    async execute(): Promise<PortfolioSnapshot> {
      const ownerId = dependencies.currentUser.currentUserId();
      const executedAt = dependencies.clock.now();
      const initialized = await dependencies.repository.initializeForOwner(
        ownerId,
        dependencies.initialDeposit,
        executedAt,
      );
      return projectInitializedPortfolio(
        initialized,
        executedAt,
        dependencies.initialDeposit,
      );
    },
  };
}
