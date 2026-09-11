import { DomainError } from "./errors";
import type { InstrumentId, PortfolioId, TransactionId } from "./ids";
import { Money, type Currency } from "./money";
import { Quantity } from "./quantity";
import { UnitPrice } from "./unit-price";
import type { MarketDataMetadata } from "./market";

export type TransactionType = "INITIAL_DEPOSIT" | "BUY" | "VOID_BUY" | "SELL";
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
  readonly unitPrice: UnitPrice | null;
  readonly grossAmount: Money;
  readonly fees: Money;
  readonly currency: Currency;
  readonly executedAt: Date;
  readonly marketSessionDate: MarketDate | null;
  readonly marketData: MarketDataMetadata | null;
  readonly source: TransactionSource;
  readonly idempotencyKey: string | null;
  readonly reversalOfTransactionId: TransactionId | null;
  readonly createdAt: Date;
  // ADR-0003: authoritative append order; the final tiebreak of the ledger
  // replay when executedAt/createdAt collide.
  readonly ledgerSequence: number;
}

export interface InitialDepositParams {
  readonly ledgerSequence?: number;
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
    marketData: null,
    source: "SYSTEM_INITIALIZATION",
    idempotencyKey: null,
    reversalOfTransactionId: null,
    createdAt: params.createdAt,
    ledgerSequence: params.ledgerSequence ?? 0,
  };
}

export interface BuyParams {
  readonly ledgerSequence?: number;
  readonly transactionId: TransactionId;
  readonly portfolioId: PortfolioId;
  readonly instrumentId: InstrumentId;
  readonly quantity: Quantity;
  readonly unitPrice: UnitPrice;
  readonly grossAmount: Money;
  readonly fees: Money;
  readonly executedAt: Date;
  readonly marketSessionDate: MarketDate;
  readonly marketData: MarketDataMetadata;
  readonly idempotencyKey: string;
}

export function createBuy(params: BuyParams): Transaction {
  if (!params.quantity.value.isPositive()) {
    throw new DomainError(
      "CORRUPT_LEDGER",
      "Una compra debe tener cantidad positiva.",
    );
  }
  if (
    params.grossAmount.currency !== params.unitPrice.currency ||
    params.fees.currency !== params.unitPrice.currency
  ) {
    throw new DomainError("CURRENCY_MISMATCH", "La compra mezcla monedas.");
  }
  return {
    id: params.transactionId,
    portfolioId: params.portfolioId,
    type: "BUY",
    instrumentId: params.instrumentId,
    quantity: params.quantity,
    unitPrice: params.unitPrice,
    grossAmount: params.grossAmount,
    fees: params.fees,
    currency: params.grossAmount.currency,
    executedAt: params.executedAt,
    marketSessionDate: params.marketSessionDate,
    marketData: params.marketData,
    source: "USER_SIMULATION",
    idempotencyKey: params.idempotencyKey,
    reversalOfTransactionId: null,
    createdAt: params.executedAt,
    ledgerSequence: params.ledgerSequence ?? 0,
  };
}

export interface VoidBuyParams {
  readonly ledgerSequence?: number;
  readonly transactionId: TransactionId;
  readonly portfolioId: PortfolioId;
  readonly reversalOfTransactionId: TransactionId;
  readonly currency: Currency;
  readonly executedAt: Date;
}

export function createVoidBuy(params: VoidBuyParams): Transaction {
  return {
    id: params.transactionId,
    portfolioId: params.portfolioId,
    type: "VOID_BUY",
    instrumentId: null,
    quantity: null,
    unitPrice: null,
    grossAmount: Money.zero(params.currency),
    fees: Money.zero(params.currency),
    currency: params.currency,
    executedAt: params.executedAt,
    marketSessionDate: null,
    marketData: null,
    source: "USER_SIMULATION",
    idempotencyKey: null,
    reversalOfTransactionId: params.reversalOfTransactionId,
    createdAt: params.executedAt,
    ledgerSequence: params.ledgerSequence ?? 0,
  };
}
