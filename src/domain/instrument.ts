import type { InstrumentId } from "./ids";
import type { Currency } from "./money";

export type InstrumentType =
  "EQUITY" | "ETF" | "FIXED_INCOME" | "FUND" | "INDEX" | "CURRENCY";

export type InstrumentStatus = "ACTIVE" | "INACTIVE" | "UNAVAILABLE";

export type PriceBasis = "UNADJUSTED_CLOSE" | "ADJUSTED_CLOSE";

// Domain § Instrument: reference entity; only EQUITY is tradable in the MVP
// and the symbol never acts as global identity.
export interface Instrument {
  readonly id: InstrumentId;
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string;
  readonly currency: Currency;
  readonly type: InstrumentType;
  readonly status: InstrumentStatus;
}
