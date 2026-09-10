import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import type { PortfolioRepository } from "@/application/ports/portfolio-repository";
import { DomainError } from "@/domain/errors";
import type { Money } from "@/domain/money";
import { projectPortfolioEvolution } from "@/domain/portfolio-evolution";

// PORT-005: one point per calendar day; ranges beyond one year are rejected
// explicitly instead of computing an unbounded series.
const MAX_EVOLUTION_DAYS = 365;

function datesBetween(from: string, to: string): string[] {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    from > to
  ) {
    throw new DomainError(
      "INVALID_DATE_RANGE",
      "El rango de evolución es inválido.",
    );
  }
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const days = (end.getTime() - start.getTime()) / 86400000;
  if (!Number.isFinite(days) || days > MAX_EVOLUTION_DAYS) {
    throw new DomainError(
      "INVALID_DATE_RANGE",
      "La evolución admite rangos de hasta 365 días.",
    );
  }
  const dates: string[] = [];
  const cursor = start;
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function createGetPortfolioEvolution(dependencies: {
  repository: PortfolioRepository;
  provider: MarketDataProvider;
  currentUser: CurrentUserProvider;
  initialDeposit: Money;
}) {
  return {
    async execute(input: { from: string; to: string }) {
      const portfolio = await dependencies.repository.findByOwner(
        dependencies.currentUser.currentUserId(),
      );
      if (!portfolio)
        throw new DomainError(
          "PORTFOLIO_NOT_INITIALIZED",
          "El portafolio no ha sido inicializado.",
        );
      const dates = datesBetween(input.from, input.to);
      const ids = [
        ...new Set(
          portfolio.ledger
            .filter((entry) => entry.type === "BUY" && entry.instrumentId)
            .map((entry) => entry.instrumentId!),
        ),
      ];
      const prices = new Map<
        string,
        readonly { sessionDate: string; close: string }[]
      >();
      await Promise.all(
        ids.map(async (id) => {
          try {
            // PORT-005: the last known close on or before each day may fall
            // before the requested window, so the series request is clamped
            // to the declared coverage of the provider.
            const latest = await dependencies.provider.getLatestPrice(
              id,
              "UNADJUSTED_CLOSE",
            );
            const coverageFrom = latest.metadata.coverageFrom;
            const coverageTo = latest.metadata.coverageTo;
            const seriesFrom =
              coverageFrom && coverageFrom < input.from
                ? coverageFrom
                : input.from;
            const seriesTo =
              coverageTo && coverageTo < input.to ? coverageTo : input.to;
            if (seriesFrom > seriesTo) {
              prices.set(id, []);
              return;
            }
            const series = await dependencies.provider.getHistoricalSeries(
              id,
              seriesFrom,
              seriesTo,
              "UNADJUSTED_CLOSE",
            );
            prices.set(
              id,
              [...series.observations].sort((a, b) =>
                a.sessionDate.localeCompare(b.sessionDate),
              ),
            );
          } catch {
            prices.set(id, []);
          }
        }),
      );
      return projectPortfolioEvolution({
        dates,
        ledger: portfolio.ledger,
        initialDeposit: dependencies.initialDeposit,
        prices,
      });
    },
  };
}
