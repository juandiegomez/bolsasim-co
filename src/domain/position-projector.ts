import { FinancialDecimal } from "./decimal";
import type Decimal from "decimal.js";
import { DomainError } from "./errors";
import { asInstrumentId } from "./ids";
import type { Instrument } from "./instrument";
import type { DataMode, PriceObservation } from "./market";
import { Money, roundMoney } from "./money";
import type { Position } from "./portfolio";
import { Quantity } from "./quantity";
import type { Transaction } from "./transaction";

export interface PositionMarketData {
  readonly instrument: Instrument;
  readonly mode: DataMode;
  readonly price: PriceObservation | null;
}

// PORT-004: aggregate immutable BUY entries; valuation is deliberately absent
// when the caller cannot provide a current closing price. Provenance comes
// from the market metadata available: current provider record first, the
// provenance stored in the BUY itself second.
export function projectPositions(
  ledger: readonly Transaction[],
  market: ReadonlyMap<string, PositionMarketData>,
): readonly Position[] {
  const grouped = new Map<
    string,
    { quantity: Decimal; cost: Money; mode: DataMode }
  >();
  for (const entry of ledger) {
    if (entry.type !== "BUY") continue;
    if (!entry.instrumentId || !entry.quantity) continue;
    const current = grouped.get(entry.instrumentId);
    const cost = entry.grossAmount.plus(entry.fees);
    const mode: DataMode =
      market.get(entry.instrumentId)?.mode ??
      (() => {
        if (!entry.marketData) {
          throw new DomainError(
            "CORRUPT_LEDGER",
            "La compra no contiene datos autoritativos.",
          );
        }
        return entry.marketData.mode;
      })();
    grouped.set(
      entry.instrumentId,
      current
        ? {
            quantity: current.quantity.plus(entry.quantity.value),
            cost: current.cost.plus(cost),
            mode,
          }
        : {
            quantity: new FinancialDecimal(entry.quantity.value),
            cost,
            mode,
          },
    );
  }
  return [...grouped.entries()].map(([instrumentId, aggregate]) => {
    const current = market.get(instrumentId);
    const quantity = Quantity.create(aggregate.quantity);
    if (!current || !current.price) {
      return {
        instrument: current?.instrument ?? {
          id: asInstrumentId(instrumentId),
          symbol: instrumentId,
          name: "Instrumento no disponible",
          exchange: "",
          currency: aggregate.cost.currency,
          type: "EQUITY",
          status: "UNAVAILABLE",
        },
        dataMode: aggregate.mode,
        quantity,
        cost: aggregate.cost,
        valuationStatus: "PRICE_UNAVAILABLE",
        price: null,
        marketValue: null,
        pnl: null,
        returnPct: null,
      };
    }
    const marketValue = roundMoney(
      quantity.value.times(current.price.close),
      aggregate.cost.currency,
    );
    const pnl = marketValue.minus(aggregate.cost);
    return {
      instrument: current.instrument,
      dataMode: current.mode,
      quantity,
      cost: aggregate.cost,
      valuationStatus: "VALUED",
      price: current.price,
      marketValue,
      pnl,
      returnPct: pnl.amount.div(aggregate.cost.amount).times(100).toFixed(2),
    };
  });
}
