import type { InstrumentId } from "./ids";
import type { PriceBasis } from "./instrument";
import type { Currency } from "./money";
import type { MarketDate } from "./transaction";

export interface MarketDataMetadata {
  readonly providerId: string;
  readonly mode: "real" | "demo";
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
