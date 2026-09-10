import { FinancialDecimal } from "./decimal";
import { DomainError } from "./errors";
import { Money, roundMoney } from "./money";
import { Quantity, roundQuantity } from "./quantity";
import { UnitPrice } from "./unit-price";

export interface PurchaseCalculation {
  readonly requestedAmount: Money;
  readonly quantity: Quantity;
  readonly grossAmount: Money;
  readonly remainder: Money;
  readonly fees: Money;
  readonly totalDebit: Money;
}

export function calculatePurchase(
  requestedAmount: Money,
  unitPrice: UnitPrice,
): PurchaseCalculation {
  if (!requestedAmount.amount.isPositive()) {
    throw new DomainError(
      "INVALID_MONEY",
      "El monto de compra debe ser positivo.",
    );
  }
  if (requestedAmount.currency !== unitPrice.currency) {
    throw new DomainError(
      "CURRENCY_MISMATCH",
      "Monto y precio usan monedas distintas.",
    );
  }
  const quantity = roundQuantity(requestedAmount.amount.div(unitPrice.amount));
  if (quantity.value.isZero()) {
    throw new DomainError(
      "PURCHASE_AMOUNT_TOO_SMALL",
      "El monto no alcanza para comprar una fracción liquidable.",
    );
  }
  const grossAmount = roundMoney(
    new FinancialDecimal(quantity.value).times(unitPrice.amount),
    requestedAmount.currency,
  );
  if (grossAmount.amount.isZero()) {
    throw new DomainError(
      "PURCHASE_AMOUNT_TOO_SMALL",
      "El importe efectivo de la compra es cero.",
    );
  }
  const remainder = requestedAmount.minus(grossAmount);
  const fees = Money.zero(requestedAmount.currency);
  return {
    requestedAmount,
    quantity,
    grossAmount,
    remainder,
    fees,
    totalDebit: grossAmount.plus(fees),
  };
}
