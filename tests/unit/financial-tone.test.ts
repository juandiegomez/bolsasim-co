import { describe, expect, it } from "vitest";
import {
  financialTone,
  financialToneLabel,
  formatSignedPercentage,
  formatVisiblePercentage,
} from "@/components/financial-tone";

describe("financial result tone", () => {
  it("classifies positive, negative and zero amounts without calculating them", () => {
    expect(financialTone("400.00")).toBe("positive");
    expect(financialTone("-25.00")).toBe("negative");
    expect(financialTone("0.00")).toBe("neutral");
    expect(financialTone(null)).toBe("neutral");
  });

  it("provides explicit labels alongside color", () => {
    expect(financialToneLabel("positive")).toBe("Ganancia");
    expect(financialToneLabel("negative")).toBe("Pérdida");
    expect(financialToneLabel("neutral")).toBe("Sin variación");
  });

  it("formats the existing percentage string with a visible sign", () => {
    expect(formatSignedPercentage("3.00")).toBe("+3.00%");
    expect(formatSignedPercentage("-1.25")).toBe("-1.25%");
    expect(formatSignedPercentage("0.00")).toBe("0.00%");
    expect(formatSignedPercentage(null)).toBeNull();
    expect(formatVisiblePercentage("0.00", "17.81")).toBe("<0.01%");
    expect(formatVisiblePercentage("0.00", "0.00")).toBe("0.00%");
  });
});
