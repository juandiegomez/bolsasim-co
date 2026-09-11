import type { BuyPreview } from "@/domain/buy-preview";
import type { Transaction } from "@/domain/transaction";
import { serializePriceObservation } from "./serialize-market";

function money(value: { toString(): string; currency: string }) {
  return { amount: value.toString(), currency: value.currency };
}

export function serializeBuyPreview(preview: BuyPreview) {
  return {
    id: preview.id,
    instrument: {
      id: preview.instrument.id,
      symbol: preview.instrument.symbol,
      name: preview.instrument.name,
      exchange: preview.instrument.exchange,
      currency: preview.instrument.currency,
      type: preview.instrument.type,
      status: preview.instrument.status,
      dataMode: preview.price.metadata.mode,
    },
    requestedAmount: money(preview.requestedAmount),
    price: serializePriceObservation(preview.price),
    quantity: preview.quantity.toString(),
    grossAmount: money(preview.grossAmount),
    remainder: money(preview.remainder),
    fees: money(preview.fees),
    totalDebit: money(preview.totalDebit),
    availableCash: money(preview.availableCash),
    expiresAt: preview.expiresAt.toISOString(),
  };
}

export function serializeTransaction(transaction: Transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    instrumentId: transaction.instrumentId,
    quantity: transaction.quantity?.toString() ?? null,
    unitPrice: transaction.unitPrice
      ? {
          amount: transaction.unitPrice.amount.toFixed(8),
          currency: transaction.unitPrice.currency,
        }
      : null,
    grossAmount: money(transaction.grossAmount),
    fees: money(transaction.fees),
    currency: transaction.currency,
    executedAt: transaction.executedAt.toISOString(),
    marketSessionDate: transaction.marketSessionDate,
    source: transaction.source,
    reversalOfTransactionId: transaction.reversalOfTransactionId,
  };
}
