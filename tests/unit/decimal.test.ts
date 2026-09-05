import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { FinancialDecimal } from "@/domain/decimal";

describe("FIN-001 (partial): exact decimal foundation", () => {
  it("adds decimal inputs exactly and serializes as a string", () => {
    const sum = new FinancialDecimal("0.1").plus("0.2");
    expect(sum.toFixed(2)).toBe("0.30");
    expect(JSON.stringify(sum)).toBe('"0.3"');
  });
  it("preserves high precision and does not mutate the global constructor", () => {
    expect(FinancialDecimal.precision).toBe(50);
    expect(new FinancialDecimal("1").div("3").toString()).toBe(
      `0.${"3".repeat(50)}`,
    );
    expect(Decimal.precision).toBe(20);
    expect(FinancialDecimal.rounding).toBe(Decimal.ROUND_HALF_UP);
  });
});
