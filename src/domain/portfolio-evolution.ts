import { FinancialDecimal } from "./decimal";
import type Decimal from "decimal.js";
import { Money, roundMoney } from "./money";
import type { Transaction } from "./transaction";

export interface EvolutionPrice {
  readonly sessionDate: string;
  readonly close: string;
}

export interface PortfolioEvolutionPoint {
  readonly date: string;
  readonly cash: Money;
  readonly totalValue: Money | null;
  readonly valuationStatus: "COMPLETE" | "INCOMPLETE";
  readonly priceSessionDates: Readonly<Record<string, string>>;
}

// PORT-005: a point carries the latest closing price on or before its date.
// Missing prior data makes the point incomplete rather than zero-valued.
export function projectPortfolioEvolution(input: {
  dates: readonly string[];
  ledger: readonly Transaction[];
  initialDeposit: Money;
  prices: ReadonlyMap<string, readonly EvolutionPrice[]>;
}): readonly PortfolioEvolutionPoint[] {
  return input.dates.map((date) => {
    let cash = Money.zero(input.initialDeposit.currency);
    const quantities = new Map<string, Decimal>();
    for (const entry of input.ledger) {
      if (entry.executedAt.toISOString().slice(0, 10) > date) continue;
      if (entry.type === "INITIAL_DEPOSIT") cash = cash.plus(entry.grossAmount);
      if (entry.type === "BUY" && entry.instrumentId && entry.quantity) {
        cash = cash.minus(entry.grossAmount.plus(entry.fees));
        quantities.set(
          entry.instrumentId,
          (quantities.get(entry.instrumentId) ?? new FinancialDecimal(0)).plus(
            entry.quantity.value,
          ),
        );
      }
    }
    let positionsValue = Money.zero(input.initialDeposit.currency);
    let incomplete = false;
    const priceSessionDates: Record<string, string> = {};
    for (const [instrumentId, quantity] of quantities) {
      const observation = [...(input.prices.get(instrumentId) ?? [])]
        .filter((price) => price.sessionDate <= date)
        .at(-1);
      if (!observation) {
        incomplete = true;
        continue;
      }
      priceSessionDates[instrumentId] = observation.sessionDate;
      positionsValue = positionsValue.plus(
        roundMoney(
          quantity.times(observation.close),
          input.initialDeposit.currency,
        ),
      );
    }
    return {
      date,
      cash,
      totalValue: incomplete ? null : cash.plus(positionsValue),
      valuationStatus: incomplete ? "INCOMPLETE" : "COMPLETE",
      priceSessionDates,
    };
  });
}
