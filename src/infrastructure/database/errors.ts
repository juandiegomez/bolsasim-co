export type PersistenceErrorCode = "DATABASE_UNAVAILABLE";

export class PersistenceError extends Error {
  constructor(
    readonly code: PersistenceErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "PersistenceError";
  }
}
