import type { Money } from "@/domain/money";
import type { PortfolioSnapshot } from "@/domain/portfolio";

function serializeMoney(money: Money): { amount: string; currency: string } {
  return { amount: money.amount.toFixed(2), currency: money.currency };
}

// OpenAPI § PortfolioSnapshot: money and decimals serialize as exact strings.
// Slice 1 has no valued positions; position serialization arrives with the
// market slices (ADR-0005).
export function serializePortfolioSnapshot(snapshot: PortfolioSnapshot) {
  return {
    portfolioId: snapshot.portfolioId,
    asOf: snapshot.asOf.toISOString(),
    cash: serializeMoney(snapshot.cash),
    investedCost: serializeMoney(snapshot.investedCost),
    positionsValue: snapshot.positionsValue
      ? serializeMoney(snapshot.positionsValue)
      : null,
    totalValue: snapshot.totalValue
      ? serializeMoney(snapshot.totalValue)
      : null,
    pnl: snapshot.pnl ? serializeMoney(snapshot.pnl) : null,
    returnPct: snapshot.returnPct,
    valuationStatus: snapshot.valuationStatus,
    positions: snapshot.positions.map((position) => {
      throw new Error(
        `POSITION_SERIALIZATION_NOT_IMPLEMENTED (${position.valuationStatus})`,
      );
    }),
  };
}
