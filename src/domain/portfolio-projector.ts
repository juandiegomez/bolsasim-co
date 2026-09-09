import { FinancialDecimal } from "./decimal";
import { DomainError } from "./errors";
import { Money } from "./money";
import type { PortfolioProjection } from "./portfolio";
import type { Transaction } from "./transaction";

function compareTransactions(a: Transaction, b: Transaction): number {
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
  for (const transaction of ordered) {
    if (transaction.type !== "INITIAL_DEPOSIT") {
      throw corrupt(
        `tipo de movimiento no soportado en este slice: ${transaction.type}`,
      );
    }
    deposits += 1;
    if (deposits > 1) {
      throw corrupt("el portafolio tiene más de un depósito inicial");
    }
    if (transaction.currency !== expectedInitialDeposit.currency) {
      throw corrupt("moneda del depósito distinta a la base del portafolio");
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
    if (cash.isNegative()) {
      throw corrupt("la secuencia deja efectivo negativo");
    }
  }
  if (deposits === 0) {
    throw corrupt("el portafolio no tiene depósito inicial");
  }
  return {
    cash: Money.create(cash, expectedInitialDeposit.currency),
    investedCost: Money.zero(expectedInitialDeposit.currency),
    valuationStatus: "COMPLETE",
  };
}
