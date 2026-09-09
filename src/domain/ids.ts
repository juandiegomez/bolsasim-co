declare const brand: unique symbol;

export type Branded<T, B extends string> = T & {
  readonly [brand]: B;
};

export type UserId = Branded<string, "UserId">;
export type PortfolioId = Branded<string, "PortfolioId">;
export type InstrumentId = Branded<string, "InstrumentId">;
export type TransactionId = Branded<string, "TransactionId">;
export type PreviewId = Branded<string, "PreviewId">;

// Values are UUIDs validated at their boundaries: environment (zod), database
// (uuid columns) and crypto.randomUUID. The brands only prevent interchange.
export function asUserId(value: string): UserId {
  return value as UserId;
}
export function asPortfolioId(value: string): PortfolioId {
  return value as PortfolioId;
}
export function asInstrumentId(value: string): InstrumentId {
  return value as InstrumentId;
}
export function asTransactionId(value: string): TransactionId {
  return value as TransactionId;
}
export function asPreviewId(value: string): PreviewId {
  return value as PreviewId;
}
