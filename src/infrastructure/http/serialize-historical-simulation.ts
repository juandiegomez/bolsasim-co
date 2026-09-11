import type { HistoricalSimulationResult } from "@/domain/historical-simulation";
import { serializePriceObservation } from "./serialize-market";
import { serializeInstrument } from "./serialize-market";

export function serializeHistoricalSimulation(
  result: HistoricalSimulationResult,
) {
  return {
    instrument: serializeInstrument(
      result.instrument,
      result.initialPrice.metadata.mode,
    ),
    requestedAmount: {
      amount: result.requestedAmount.toString(),
      currency: result.requestedAmount.currency,
    },
    requestedStartDate: result.requestedStartDate,
    requestedEndDate: result.requestedEndDate,
    effectiveStartDate: result.effectiveStartDate,
    effectiveEndDate: result.effectiveEndDate,
    initialPrice: serializePriceObservation(result.initialPrice),
    finalPrice: serializePriceObservation(result.finalPrice),
    quantity: result.quantity.toString(),
    investedAmount: {
      amount: result.investedAmount.toString(),
      currency: result.investedAmount.currency,
    },
    remainder: {
      amount: result.remainder.toString(),
      currency: result.remainder.currency,
    },
    finalValue: {
      amount: result.finalValue.toString(),
      currency: result.finalValue.currency,
    },
    pnl: {
      amount: result.pnl.toString(),
      currency: result.pnl.currency,
    },
    returnPct: result.returnPct?.toFixed() ?? null,
    series: result.series.map((point) => ({
      date: point.date,
      price: point.price.toString(),
      value: {
        amount: point.value.toString(),
        currency: point.value.currency,
      },
    })),
    assumptions: [...result.assumptions],
  };
}
