import { describe, expect, it } from "vitest";
import { currentMarketDate, isDatasetStale } from "../../scripts/market-date";

describe("demo refresh policy", () => {
  it("uses the New York market date across midnight UTC", () => {
    expect(currentMarketDate(new Date("2026-09-11T02:00:00.000Z"))).toBe(
      "2026-09-10",
    );
    expect(currentMarketDate(new Date("2026-09-11T04:00:00.000Z"))).toBe(
      "2026-09-11",
    );
  });

  it("refreshes only when the snapshot cutoff is behind the market date", () => {
    expect(isDatasetStale(undefined, "2026-09-11")).toBe(true);
    expect(isDatasetStale("2026-09-09", "2026-09-11")).toBe(true);
    expect(isDatasetStale("2026-09-11", "2026-09-11")).toBe(false);
    expect(isDatasetStale("2026-09-12", "2026-09-11")).toBe(false);
  });
});
