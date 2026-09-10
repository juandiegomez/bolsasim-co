import { FinancialDecimal } from "./decimal";
import type { Instrument } from "./instrument";
import type { DataMode, PriceObservation } from "./market";
import { Money } from "./money";
import type { Quantity } from "./quantity";
import type { PortfolioId } from "./ids";

export type ValuationStatus = "COMPLETE" | "INCOMPLETE";
export type PositionValuationStatus =
  "VALUED" | "PRICE_UNAVAILABLE" | "CORPORATE_ACTION_UNSUPPORTED";

// Domain § Position: projection derived from ledger transactions, never a
// mutable entity. Cost is the sum of purchases while there are no sales.
// dataMode is the provenance declared by the market data of the purchase.
export interface Position {
  readonly instrument: Instrument;
  readonly dataMode: DataMode;
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
  positions?: readonly Position[];
}): PortfolioSnapshot {
  const positions = params.positions ?? [];
  const hasUnvaluedPositions =
    positions.some((position) => position.valuationStatus !== "VALUED") ||
    (positions.length === 0 &&
      params.projection.investedCost.amount.greaterThan(0));
  const positionsValue = hasUnvaluedPositions
    ? null
    : positions.reduce(
        (total, position) => total.plus(position.marketValue!),
        Money.zero(params.projection.cash.currency),
      );
  const totalValue = positionsValue
    ? params.projection.cash.plus(positionsValue)
    : null;
  // PORT-004: portfolio P&L compares the complete current value (cash plus
  // positions) with the initial capital, never with the position value alone.
  const pnl = totalValue ? totalValue.minus(params.initialDeposit) : null;
  const returnPct =
    !pnl || params.initialDeposit.amount.isZero()
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
    valuationStatus: hasUnvaluedPositions
      ? "INCOMPLETE"
      : params.projection.valuationStatus,
    positions,
  };
}
