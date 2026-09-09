import { FinancialDecimal } from "./decimal";
import type { Instrument } from "./instrument";
import type { PriceObservation } from "./market";
import { Money } from "./money";
import type { Quantity } from "./quantity";
import type { PortfolioId } from "./ids";

export type ValuationStatus = "COMPLETE" | "INCOMPLETE";
export type PositionValuationStatus =
  "VALUED" | "PRICE_UNAVAILABLE" | "CORPORATE_ACTION_UNSUPPORTED";

// Domain § Position: projection derived from ledger transactions, never a
// mutable entity. Cost is the sum of purchases while there are no sales.
export interface Position {
  readonly instrument: Instrument;
  readonly quantity: Quantity;
  readonly cost: Money;
  readonly valuationStatus: PositionValuationStatus;
  readonly price: PriceObservation | null;
  readonly marketValue: Money | null;
  readonly pnl: Money | null;
  readonly returnPct: string | null;
}

export interface PortfolioProjection {
  readonly cash: Money;
  readonly investedCost: Money;
  readonly valuationStatus: ValuationStatus;
}

export interface PortfolioSnapshot {
  readonly portfolioId: PortfolioId;
  readonly asOf: Date;
  readonly cash: Money;
  readonly investedCost: Money;
  readonly positionsValue: Money | null;
  readonly totalValue: Money | null;
  readonly pnl: Money | null;
  readonly returnPct: string | null;
  readonly valuationStatus: ValuationStatus;
  readonly positions: readonly Position[];
}

// Domain § PortfolioSnapshot: derived view; the portfolio return uses the
// initial deposit as denominator and returns null when it is zero.
export function buildPortfolioSnapshot(params: {
  portfolioId: PortfolioId;
  asOf: Date;
  projection: PortfolioProjection;
  initialDeposit: Money;
}): PortfolioSnapshot {
  const positions: readonly Position[] = [];
  const positionsValue = Money.zero(params.projection.cash.currency);
  const totalValue = params.projection.cash.plus(positionsValue);
  const pnl = positionsValue;
  const returnPct = params.initialDeposit.amount.isZero()
    ? null
    : new FinancialDecimal(
        pnl.amount.div(params.initialDeposit.amount).times(100),
      ).toFixed(2);
  return {
    portfolioId: params.portfolioId,
    asOf: params.asOf,
    cash: params.projection.cash,
    investedCost: params.projection.investedCost,
    positionsValue,
    totalValue,
    pnl,
    returnPct,
    valuationStatus: params.projection.valuationStatus,
    positions,
  };
}
