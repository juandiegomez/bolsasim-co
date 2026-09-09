export type DomainErrorCode =
  | "INVALID_MONEY"
  | "INVALID_SCALE"
  | "CURRENCY_MISMATCH"
  | "PORTFOLIO_NOT_INITIALIZED"
  | "CORRUPT_LEDGER";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "DomainError";
  }
}
