import Decimal from "decimal.js";
import { FinancialDecimal } from "./decimal";
import { DomainError } from "./errors";

export type Currency = "COP";

const MONEY_SCALE = 2;
const MONEY_LIMIT = new FinancialDecimal("1e22");

function toDecimal(value: string | Decimal): Decimal {
  return value instanceof Decimal ? value : new FinancialDecimal(value);
}

// FIN-001/FIN-002: exact money with explicit currency; scale 2, magnitude numeric(24,2).
export class Money {
  private constructor(
    readonly amount: Decimal,
    readonly currency: Currency,
  ) {}

  static create(value: string | Decimal, currency: Currency): Money {
    const decimal = toDecimal(value);
    if (!decimal.isFinite()) {
      throw new DomainError(
        "INVALID_MONEY",
        "El monto debe ser un número finito.",
      );
    }
    if (decimal.decimalPlaces() > MONEY_SCALE) {
      throw new DomainError(
        "INVALID_SCALE",
        `El dinero admite máximo ${MONEY_SCALE} decimales; no se redondea silenciosamente.`,
      );
    }
    if (decimal.abs().greaterThanOrEqualTo(MONEY_LIMIT)) {
      throw new DomainError(
        "INVALID_MONEY",
        "El monto excede la magnitud soportada por numeric(24,2).",
      );
    }
    return new Money(decimal, currency);
  }

  static zero(currency: Currency): Money {
    return Money.create("0.00", currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount.plus(other.amount), this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount.minus(other.amount), this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.eq(other.amount);
  }

  toString(): string {
    return this.amount.toFixed(MONEY_SCALE);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError(
        "CURRENCY_MISMATCH",
        "La operación combina monedas distintas.",
      );
    }
  }
}

// FIN-002: explicit HALF_UP rounding of money after exact calculations.
export function roundMoney(value: Decimal, currency: Currency): Money {
  return Money.create(value.toFixed(MONEY_SCALE), currency);
}
