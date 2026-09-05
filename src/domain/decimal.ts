import Decimal from "decimal.js";

// FIN-001 foundation only; Money/Quantity invariants belong to later slices.
export const FinancialDecimal = Decimal.clone({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
});
