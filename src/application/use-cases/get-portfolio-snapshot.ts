import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { PortfolioRepository } from "@/application/ports/portfolio-repository";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import { DomainError } from "@/domain/errors";
import type { Money } from "@/domain/money";
import type { PortfolioSnapshot } from "@/domain/portfolio";
import { buildPortfolioSnapshot } from "@/domain/portfolio";
import { projectLedger } from "@/domain/portfolio-projector";
import {
  projectPositions,
  type PositionMarketData,
} from "@/domain/position-projector";

export interface GetPortfolioSnapshotDependencies {
  readonly repository: PortfolioRepository;
  readonly currentUser: CurrentUserProvider;
  readonly clock: Clock;
  readonly initialDeposit: Money;
  readonly provider?: MarketDataProvider;
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
      const instrumentIds = [
        ...new Set(
          initialized.ledger
            .filter((entry) => entry.type === "BUY" && entry.instrumentId)
            .map((entry) => entry.instrumentId!),
        ),
      ];
      const market = new Map<string, PositionMarketData>();
      if (dependencies.provider) {
        await Promise.all(
          instrumentIds.map(async (instrumentId) => {
            try {
              const record =
                await dependencies.provider!.getInstrument(instrumentId);
              const price = await dependencies.provider!.getLatestPrice(
                instrumentId,
                "UNADJUSTED_CLOSE",
              );
              market.set(instrumentId, {
                instrument: record.instrument,
                mode: record.metadata.mode,
                price,
              });
            } catch {
              // PORT-004: market absence is represented explicitly in the projection.
            }
          }),
        );
      }
      return buildPortfolioSnapshot({
        portfolioId: initialized.portfolioId,
        asOf,
        projection,
        initialDeposit: dependencies.initialDeposit,
        positions: projectPositions(initialized.ledger, market),
      });
    },
  };
}
