import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import type { InstrumentId } from "@/domain/ids";
import type { Instrument, PriceBasis } from "@/domain/instrument";
import type {
  HistoricalSeries,
  InstrumentRecord,
  Page,
  PriceObservation,
} from "@/domain/market";
import type { MarketDate } from "@/domain/transaction";

// INST-001/MDATA-001: the server mediates every market read; the UI never
// calls a provider directly.
export function createListInstruments(dependencies: {
  provider: MarketDataProvider;
}) {
  return {
    async execute(
      input: ListInstrumentsInput,
    ): Promise<Page<InstrumentRecord>> {
      if (input.query && input.query.trim().length > 0) {
        return dependencies.provider.searchInstruments(
          input.query,
          input.cursor,
          input.limit,
        );
      }
      return dependencies.provider.listInstruments(
        { status: input.status },
        input.cursor,
        input.limit,
      );
    },
  };
}

export interface ListInstrumentsInput {
  readonly query?: string;
  readonly status?: Instrument["status"];
  readonly cursor?: string;
  readonly limit?: number;
}

export function createGetInstrumentDetail(dependencies: {
  provider: MarketDataProvider;
}) {
  return {
    async execute(instrumentId: InstrumentId): Promise<InstrumentRecord> {
      return dependencies.provider.getInstrument(instrumentId);
    },
  };
}

export function createGetLatestPrice(dependencies: {
  provider: MarketDataProvider;
}) {
  return {
    async execute(
      instrumentId: InstrumentId,
      basis: PriceBasis,
    ): Promise<PriceObservation> {
      return dependencies.provider.getLatestPrice(instrumentId, basis);
    },
  };
}

export function createGetHistoricalSeries(dependencies: {
  provider: MarketDataProvider;
}) {
  return {
    async execute(input: {
      instrumentId: InstrumentId;
      from: MarketDate;
      to: MarketDate;
      basis: PriceBasis;
    }): Promise<HistoricalSeries> {
      return dependencies.provider.getHistoricalSeries(
        input.instrumentId,
        input.from,
        input.to,
        input.basis,
      );
    },
  };
}
