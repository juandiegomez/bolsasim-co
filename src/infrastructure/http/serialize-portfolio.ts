import type { Money } from "@/domain/money";
import type { PortfolioSnapshot } from "@/domain/portfolio";
import { serializePriceObservation } from "./serialize-market";

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
    positions: snapshot.positions.map((position) => ({
      instrument: {
        id: position.instrument.id,
        symbol: position.instrument.symbol,
        name: position.instrument.name,
        exchange: position.instrument.exchange,
        currency: position.instrument.currency,
        type: position.instrument.type,
        status: position.instrument.status,
        dataMode: position.dataMode,
      },
      quantity: position.quantity.toString(),
      cost: serializeMoney(position.cost),
      valuationStatus: position.valuationStatus,
      price: position.price ? serializePriceObservation(position.price) : null,
      marketValue: position.marketValue
        ? serializeMoney(position.marketValue)
        : null,
      pnl: position.pnl ? serializeMoney(position.pnl) : null,
      returnPct: position.returnPct,
    })),
  };
}
