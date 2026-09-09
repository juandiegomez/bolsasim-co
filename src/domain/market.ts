import type { InstrumentId } from "./ids";
import type { Instrument, PriceBasis } from "./instrument";
import type { Currency } from "./money";
import type { MarketDate } from "./transaction";

export type DataMode = "real" | "demo";
export type DateResolution = "ON_OR_AFTER" | "ON_OR_BEFORE";

export interface MarketDataMetadata {
  readonly providerId: string;
  readonly mode: DataMode;
  readonly retrievedAt: Date;
  readonly priceBasis: PriceBasis;
  readonly coverageFrom: MarketDate | null;
  readonly coverageTo: MarketDate | null;
  readonly adjustedPricePolicy: string;
  readonly limitations: readonly string[];
}

// Domain § Base de precio: the session date identifies the market day of the
// close actually used; HTTP serializes the close as an exact decimal string.
export interface PriceObservation {
  readonly instrumentId: InstrumentId;
  readonly sessionDate: MarketDate;
  readonly close: string;
  readonly currency: Currency;
  readonly metadata: MarketDataMetadata;
}

// Market data contract § Operaciones: inclusive ascending series without
// duplicates, positive values, single currency and price basis.
export interface HistoricalSeries {
  readonly instrumentId: InstrumentId;
  readonly observations: readonly PriceObservation[];
  readonly metadata: MarketDataMetadata;
}

// Market data contract § InstrumentMetadata: reference metadata plus the
// source metadata that carries the real/demo provenance.
export interface InstrumentRecord {
  readonly instrument: Instrument;
  readonly metadata: MarketDataMetadata;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
