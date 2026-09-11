import { DomainError } from "@/domain/errors";
import {
  calculateHistoricalInvestment,
  type HistoricalSimulationResult,
} from "@/domain/historical-simulation";
import type { InstrumentId } from "@/domain/ids";
import type { PriceBasis } from "@/domain/instrument";
import { Money } from "@/domain/money";
import type { MarketDate } from "@/domain/transaction";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isMarketDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function validateDates(
  requestedStartDate: string,
  requestedEndDate: string | null,
): void {
  if (
    !isMarketDate(requestedStartDate) ||
    (requestedEndDate !== null && !isMarketDate(requestedEndDate))
  ) {
    throw new DomainError(
      "INVALID_DATE_RANGE",
      "Las fechas de la simulación deben usar YYYY-MM-DD.",
    );
  }
  if (requestedEndDate !== null && requestedStartDate > requestedEndDate) {
    throw new DomainError(
      "INVALID_DATE_RANGE",
      "La fecha inicial no puede ser posterior a la fecha final.",
    );
  }
}

export interface RunHistoricalSimulationInput {
  readonly instrumentId: InstrumentId;
  readonly amount: Money;
  readonly requestedStartDate: string;
  readonly requestedEndDate: string | null;
  readonly priceBasis: PriceBasis;
}

export function createRunHistoricalSimulation(dependencies: {
  provider: MarketDataProvider;
}) {
  return {
    async execute(
      input: RunHistoricalSimulationInput,
    ): Promise<HistoricalSimulationResult> {
      validateDates(input.requestedStartDate, input.requestedEndDate);
      const instrumentRecord = await dependencies.provider.getInstrument(
        input.instrumentId,
      );
      const initialPrice = await dependencies.provider.getPriceOnDate(
        input.instrumentId,
        input.requestedStartDate as MarketDate,
        "ON_OR_AFTER",
        input.priceBasis,
      );
      const finalPrice =
        input.requestedEndDate === null
          ? await dependencies.provider.getLatestPrice(
              input.instrumentId,
              input.priceBasis,
            )
          : await dependencies.provider.getPriceOnDate(
              input.instrumentId,
              input.requestedEndDate as MarketDate,
              "ON_OR_BEFORE",
              input.priceBasis,
            );
      if (initialPrice.sessionDate > finalPrice.sessionDate) {
        throw new DomainError(
          "INVALID_DATE_RANGE",
          "No existe una sesión final posterior a la sesión inicial.",
        );
      }
      const historicalSeries = await dependencies.provider.getHistoricalSeries(
        input.instrumentId,
        initialPrice.sessionDate,
        finalPrice.sessionDate,
        input.priceBasis,
      );
      return calculateHistoricalInvestment({
        instrument: instrumentRecord.instrument,
        requestedAmount: input.amount,
        requestedStartDate: input.requestedStartDate,
        requestedEndDate: input.requestedEndDate,
        initialPrice,
        finalPrice,
        series: historicalSeries,
      });
    },
  };
}
