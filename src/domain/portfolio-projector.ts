import { FinancialDecimal } from "./decimal";
import { DomainError } from "./errors";
import { Money } from "./money";
import type { PortfolioProjection } from "./portfolio";
import type { Transaction } from "./transaction";

function compareTransactions(a: Transaction, b: Transaction): number {
  // ADR-0003: the append order of the ledger is authoritative; executedAt
  // and createdAt only order within the same append sequence value.
  const bySequence = a.ledgerSequence - b.ledgerSequence;
  if (bySequence !== 0) return bySequence;
  const byExecutedAt = a.executedAt.getTime() - b.executedAt.getTime();
  if (byExecutedAt !== 0) return byExecutedAt;
  const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreatedAt !== 0) return byCreatedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function corrupt(detail: string): DomainError {
  return new DomainError(
    "CORRUPT_LEDGER",
    `Secuencia de ledger inválida: ${detail}`,
  );
}

// Domain § PortfolioProjector: replay in deterministic (executedAt, createdAt,
// id) order; a corrupt sequence fails explicitly, never with a partial view.
export function projectLedger(
  transactions: readonly Transaction[],
  expectedInitialDeposit: Money,
): PortfolioProjection {
  const ordered = [...transactions].sort(compareTransactions);
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index] !== transactions[index]) {
      throw corrupt("la secuencia no está en el orden determinista del ledger");
    }
  }
  let cash = new FinancialDecimal("0.00");
  let deposits = 0;
  let investedCost = new FinancialDecimal("0.00");
  for (const transaction of ordered) {
    if (transaction.currency !== expectedInitialDeposit.currency) {
      throw corrupt("moneda de movimiento distinta a la base del portafolio");
    }
    if (transaction.type === "INITIAL_DEPOSIT") {
      deposits += 1;
      if (deposits > 1) {
        throw corrupt("el portafolio tiene más de un depósito inicial");
      }
      if (!transaction.grossAmount.amount.eq(expectedInitialDeposit.amount)) {
        throw corrupt(
          "el monto del depósito inicial no coincide con el esperado",
        );
      }
      if (!transaction.fees.amount.isZero()) {
        throw corrupt("el depósito inicial no debe tener comisiones");
      }
      cash = cash.plus(transaction.grossAmount.amount);
    } else if (transaction.type === "BUY") {
      if (
        !transaction.instrumentId ||
        !transaction.quantity ||
        !transaction.unitPrice ||
        !transaction.marketSessionDate ||
        !transaction.marketData ||
        transaction.source !== "USER_SIMULATION" ||
        !transaction.idempotencyKey
      ) {
        throw corrupt("la compra no contiene todos los datos autoritativos");
      }
      const debit = transaction.grossAmount.amount.plus(
        transaction.fees.amount,
      );
      cash = cash.minus(debit);
      investedCost = investedCost.plus(debit);
    } else {
      throw corrupt(`tipo de movimiento no soportado: ${transaction.type}`);
    }
    if (cash.isNegative()) {
      throw corrupt("la secuencia deja efectivo negativo");
    }
  }
  if (deposits === 0) {
    throw corrupt("el portafolio no tiene depósito inicial");
  }
  return {
    cash: Money.create(cash, expectedInitialDeposit.currency),
    investedCost: Money.create(investedCost, expectedInitialDeposit.currency),
    valuationStatus: "COMPLETE",
  };
}
