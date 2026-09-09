import Decimal from "decimal.js";
import { FinancialDecimal } from "./decimal";
import { DomainError } from "./errors";

const QUANTITY_SCALE = 8;
const QUANTITY_LIMIT = new FinancialDecimal("1e16");

// FIN-002: non-negative decimal quantity with scale 8, magnitude numeric(24,8).
export class Quantity {
  private constructor(readonly value: Decimal) {}

  static create(value: string | Decimal): Quantity {
    const decimal =
      value instanceof Decimal ? value : new FinancialDecimal(value);
    if (!decimal.isFinite()) {
      throw new DomainError(
        "INVALID_SCALE",
        "La cantidad debe ser un número finito.",
      );
    }
    if (decimal.isNegative()) {
      throw new DomainError(
        "INVALID_SCALE",
        "La cantidad no puede ser negativa.",
      );
    }
    if (decimal.decimalPlaces() > QUANTITY_SCALE) {
      throw new DomainError(
        "INVALID_SCALE",
        `La cantidad admite máximo ${QUANTITY_SCALE} decimales; no se redondea silenciosamente.`,
      );
    }
    if (decimal.abs().greaterThanOrEqualTo(QUANTITY_LIMIT)) {
      throw new DomainError(
        "INVALID_SCALE",
        "La cantidad excede la magnitud soportada por numeric(24,8).",
      );
    }
    return new Quantity(decimal);
  }

  toString(): string {
    return this.value.toFixed(QUANTITY_SCALE);
  }
}

// FIN-002: explicit ROUND_DOWN to 8 decimals for fractional quantities.
export function roundQuantity(value: Decimal): Quantity {
  return Quantity.create(
    new FinancialDecimal(
      value.toFixed(QUANTITY_SCALE, FinancialDecimal.ROUND_DOWN),
    ),
  );
}
