import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { PortfolioRepository } from "@/application/ports/portfolio-repository";
import { DomainError } from "@/domain/errors";
import type { Money } from "@/domain/money";
import type { PortfolioSnapshot } from "@/domain/portfolio";
import { buildPortfolioSnapshot } from "@/domain/portfolio";
import { projectLedger } from "@/domain/portfolio-projector";

export interface GetPortfolioSnapshotDependencies {
  readonly repository: PortfolioRepository;
  readonly currentUser: CurrentUserProvider;
  readonly clock: Clock;
  readonly initialDeposit: Money;
}

// PORT-002: the snapshot is always derived from the immutable ledger; a
// portfolio that was never initialized fails explicitly.
export function createGetPortfolioSnapshot(
  dependencies: GetPortfolioSnapshotDependencies,
) {
  return {
    async execute(): Promise<PortfolioSnapshot> {
      const ownerId = dependencies.currentUser.currentUserId();
      const initialized = await dependencies.repository.findByOwner(ownerId);
      if (!initialized) {
        throw new DomainError(
          "PORTFOLIO_NOT_INITIALIZED",
          "El portafolio no ha sido inicializado.",
        );
      }
      const asOf = dependencies.clock.now();
      const projection = projectLedger(
        initialized.ledger,
        dependencies.initialDeposit,
      );
      return buildPortfolioSnapshot({
        portfolioId: initialized.portfolioId,
        asOf,
        projection,
        initialDeposit: dependencies.initialDeposit,
      });
    },
  };
}
