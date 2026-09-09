import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { FinancialDecimal } from "@/domain/decimal";
import { DomainError } from "@/domain/errors";
import { Money, roundMoney } from "@/domain/money";
import { Quantity, roundQuantity } from "@/domain/quantity";

describe("FIN-001: Money keeps exact decimals with explicit currency", () => {
  it("serializes with fixed scale 2 and adds exactly", () => {
    const deposit = Money.create("10000000.00", "COP");
    expect(deposit.toString()).toBe("10000000.00");
    expect(deposit.currency).toBe("COP");
    expect(
      Money.create("0.1", "COP").plus(Money.create("0.2", "COP")).toString(),
    ).toBe("0.30");
  });
  it("rejects excessive scale instead of rounding silently", () => {
    expect(() => Money.create("1.005", "COP")).toThrow(DomainError);
    try {
      Money.create("1.005", "COP");
    } catch (error) {
      expect((error as DomainError).code).toBe("INVALID_SCALE");
    }
  });
  it("rejects non-finite, out-of-range amounts and non-COP currencies", () => {
    expect(() => Money.create("Infinity", "COP")).toThrow(DomainError);
    expect(() => Money.create(new Decimal("1e22"), "COP")).toThrow(DomainError);
    try {
      Money.create("1.00", "USD" as never);
    } catch (error) {
      expect((error as DomainError).code).toBe("CURRENCY_MISMATCH");
    }
  });
  it("allows negative values only as intermediate projection inputs", () => {
    expect(Money.create("-1.50", "COP").toString()).toBe("-1.50");
    expect(Money.zero("COP").equals(Money.create("0.00", "COP"))).toBe(true);
  });
});

describe("FIN-002: explicit rounding and boundaries", () => {
  it("rounds money HALF_UP only through roundMoney", () => {
    expect(roundMoney(new FinancialDecimal("1.005"), "COP").toString()).toBe(
      "1.01",
    );
    expect(roundMoney(new FinancialDecimal("2.674"), "COP").toString()).toBe(
      "2.67",
    );
  });
  it("floors quantities to 8 decimals without accepting more scale", () => {
    expect(roundQuantity(new FinancialDecimal("0.123456789")).toString()).toBe(
      "0.12345678",
    );
    expect(() => Quantity.create("0.123456789")).toThrow(DomainError);
  });
  it("rejects negative or non-finite quantities", () => {
    expect(() => Quantity.create("-1")).toThrow(DomainError);
    expect(() => Quantity.create("Infinity")).toThrow(DomainError);
  });
});
