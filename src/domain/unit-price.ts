import Decimal from "decimal.js";
import { FinancialDecimal } from "./decimal";
import { DomainError } from "./errors";
import type { Currency } from "./money";

const UNIT_PRICE_SCALE = 8;
const UNIT_PRICE_LIMIT = new FinancialDecimal("1e20");

export class UnitPrice {
  private constructor(
    readonly amount: Decimal,
    readonly currency: Currency,
  ) {}

  static create(value: string | Decimal, currency: Currency): UnitPrice {
    const amount =
      value instanceof Decimal ? value : new FinancialDecimal(value);
    if (!amount.isFinite() || !amount.isPositive()) {
      throw new DomainError(
        "INVALID_UNIT_PRICE",
        "El precio debe ser positivo.",
      );
    }
    if (amount.decimalPlaces() > UNIT_PRICE_SCALE) {
      throw new DomainError(
        "INVALID_SCALE",
        "El precio admite máximo 8 decimales; no se redondea silenciosamente.",
      );
    }
    if (amount.greaterThanOrEqualTo(UNIT_PRICE_LIMIT)) {
      throw new DomainError(
        "INVALID_UNIT_PRICE",
        "El precio excede la magnitud soportada por numeric(28,8).",
      );
    }
    return new UnitPrice(amount, currency);
  }

  toString(): string {
    return this.amount.toFixed(UNIT_PRICE_SCALE);
  }
}
