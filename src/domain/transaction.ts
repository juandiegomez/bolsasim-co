import { DomainError } from "./errors";
import type { InstrumentId, PortfolioId, TransactionId } from "./ids";
import { Money, type Currency } from "./money";
import { Quantity } from "./quantity";

export type TransactionType = "INITIAL_DEPOSIT" | "BUY" | "SELL";
export type TransactionSource = "SYSTEM_INITIALIZATION" | "USER_SIMULATION";
export type MarketDate = string;

// Domain § Transaction: immutable movement; deposit keeps instrument/quantity/
// price null. BUY and SELL stay in the type union as reserved (ADR-0003).
export interface Transaction {
  readonly id: TransactionId;
  readonly portfolioId: PortfolioId;
  readonly type: TransactionType;
  readonly instrumentId: InstrumentId | null;
  readonly quantity: Quantity | null;
  readonly unitPrice: Money | null;
  readonly grossAmount: Money;
  readonly fees: Money;
  readonly currency: Currency;
  readonly executedAt: Date;
  readonly marketSessionDate: MarketDate | null;
  readonly source: TransactionSource;
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;
}

export interface InitialDepositParams {
  readonly transactionId: TransactionId;
  readonly portfolioId: PortfolioId;
  readonly deposit: Money;
  readonly executedAt: Date;
  readonly createdAt: Date;
}

export function createInitialDeposit(
  params: InitialDepositParams,
): Transaction {
  if (!params.deposit.amount.isPositive()) {
    throw new DomainError(
      "INVALID_MONEY",
      "El depósito inicial debe ser positivo.",
    );
  }
  return {
    id: params.transactionId,
    portfolioId: params.portfolioId,
    type: "INITIAL_DEPOSIT",
    instrumentId: null,
    quantity: null,
    unitPrice: null,
    grossAmount: params.deposit,
    fees: Money.zero(params.deposit.currency),
    currency: params.deposit.currency,
    executedAt: params.executedAt,
    marketSessionDate: null,
    source: "SYSTEM_INITIALIZATION",
    idempotencyKey: null,
    createdAt: params.createdAt,
  };
}
