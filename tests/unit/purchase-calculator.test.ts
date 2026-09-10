import { describe, expect, it } from "vitest";
import { calculatePurchase } from "@/domain/purchase-calculator";
import { Money } from "@/domain/money";
import { UnitPrice } from "@/domain/unit-price";

describe("PORT-003/FIN-001/FIN-002/FIN-003: PurchaseCalculator", () => {
  it("calculates an exact COP 2 million purchase without fees", () => {
    const result = calculatePurchase(
      Money.create("2000000.00", "COP"),
      UnitPrice.create("2500.00000000", "COP"),
    );
    expect(result.quantity.toString()).toBe("800.00000000");
    expect(result.grossAmount.toString()).toBe("2000000.00");
    expect(result.remainder.toString()).toBe("0.00");
    expect(result.totalDebit.toString()).toBe("2000000.00");
  });

  it("rounds quantity down and leaves its remainder as cash", () => {
    const result = calculatePurchase(
      Money.create("100.00", "COP"),
      UnitPrice.create("33.33333333", "COP"),
    );
    expect(result.quantity.toString()).toBe("3.00000000");
    expect(result.grossAmount.toString()).toBe("100.00");
  });

  it("rejects a positive amount that cannot produce a liquidable fraction", () => {
    expect(() =>
      calculatePurchase(
        Money.create("0.01", "COP"),
        UnitPrice.create("99999999999999999999.00000000", "COP"),
      ),
    ).toThrow(/PURCHASE_AMOUNT_TOO_SMALL/);
  });
});
