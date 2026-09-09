import type { InstrumentStatus, PriceBasis } from "@/domain/instrument";
import type {
  DateResolution,
  HistoricalSeries,
  InstrumentRecord,
  Page,
  PriceObservation,
} from "@/domain/market";
import type { InstrumentId } from "@/domain/ids";
import type { MarketDate } from "@/domain/transaction";

export interface InstrumentFilters {
  readonly status?: InstrumentStatus;
}

// Data contract § Operaciones: the sole seam between the application and any
// market source (mock, file dataset or approved real provider).
export interface MarketDataProvider {
  listInstruments(
    filters: InstrumentFilters,
    cursor?: string,
    limit?: number,
  ): Promise<Page<InstrumentRecord>>;
  searchInstruments(
    query: string,
    cursor?: string,
    limit?: number,
  ): Promise<Page<InstrumentRecord>>;
  getInstrument(instrumentId: InstrumentId): Promise<InstrumentRecord>;
  getLatestPrice(
    instrumentId: InstrumentId,
    basis: PriceBasis,
  ): Promise<PriceObservation>;
  getPriceOnDate(
    instrumentId: InstrumentId,
    requestedDate: MarketDate,
    resolution: DateResolution,
    basis: PriceBasis,
  ): Promise<PriceObservation>;
  getHistoricalSeries(
    instrumentId: InstrumentId,
    from: MarketDate,
    to: MarketDate,
    basis: PriceBasis,
  ): Promise<HistoricalSeries>;
}
