import { describe, expect, it } from "vitest";
import { asInstrumentId } from "@/domain/ids";
import { calculateHistoricalInvestment } from "@/domain/historical-simulation";
import { Money } from "@/domain/money";
import type { HistoricalSeries, PriceObservation } from "@/domain/market";

const instrument = {
  id: asInstrumentId("a1b2c3d4-0001-4a01-9a01-000000000001"),
  symbol: "DEMO1",
  name: "Demo Uno",
  exchange: "DEMO",
  currency: "COP" as const,
  type: "EQUITY" as const,
  status: "ACTIVE" as const,
};

function observation(sessionDate: string, close: string): PriceObservation {
  return {
    instrumentId: instrument.id,
    sessionDate,
    close,
    currency: "COP",
    metadata: {
      providerId: "test",
      mode: "demo",
      retrievedAt: new Date("2026-09-09T13:00:00.000Z"),
      priceBasis: "UNADJUSTED_CLOSE",
      coverageFrom: "2026-08-03",
      coverageTo: "2026-08-28",
      adjustedPricePolicy: "No aplica",
      limitations: ["fixture"],
    },
  };
}

function series(observations: readonly PriceObservation[]): HistoricalSeries {
  return {
    instrumentId: instrument.id,
    observations,
    metadata: observations[0]!.metadata,
  };
}

describe("HIST-003/FIN-001/FIN-002/FIN-003: historical investment calculator", () => {
  it("calculates 20% for COP 1,000,000 from 100 to 120", () => {
    const initialPrice = observation("2026-08-03", "100");
    const finalPrice = observation("2026-08-28", "120");
    const result = calculateHistoricalInvestment({
      instrument,
      requestedAmount: Money.create("1000000.00", "COP"),
      requestedStartDate: "2026-08-01",
      requestedEndDate: "2026-08-28",
      initialPrice,
      finalPrice,
      series: series([initialPrice, finalPrice]),
    });

    expect(result.quantity.toString()).toBe("10000.00000000");
    expect(result.investedAmount.toString()).toBe("1000000.00");
    expect(result.remainder.toString()).toBe("0.00");
    expect(result.finalValue.toString()).toBe("1200000.00");
    expect(result.pnl.toString()).toBe("200000.00");
    expect(result.returnPct?.toFixed(2)).toBe("20.00");
    expect(result.series.map((point) => point.value.toString())).toEqual([
      "1000000.00",
      "1200000.00",
    ]);
  });

  it("keeps the fractional remainder as cash", () => {
    const initialPrice = observation("2026-08-03", "33.33333333");
    const finalPrice = observation("2026-08-28", "40");
    const result = calculateHistoricalInvestment({
      instrument,
      requestedAmount: Money.create("100.00", "COP"),
      requestedStartDate: "2026-08-03",
      requestedEndDate: "2026-08-28",
      initialPrice,
      finalPrice,
      series: series([initialPrice, finalPrice]),
    });

    expect(result.quantity.toString()).toBe("3.00000000");
    expect(result.investedAmount.toString()).toBe("100.00");
    expect(result.remainder.toString()).toBe("0.00");
    expect(result.finalValue.toString()).toBe("120.00");
  });

  it("fails on an amount too small for a liquidable fraction", () => {
    const initialPrice = observation("2026-08-03", "99999999999999999999");
    const finalPrice = observation("2026-08-28", "100");
    expect(() =>
      calculateHistoricalInvestment({
        instrument,
        requestedAmount: Money.create("0.01", "COP"),
        requestedStartDate: "2026-08-03",
        requestedEndDate: "2026-08-28",
        initialPrice,
        finalPrice,
        series: series([initialPrice, finalPrice]),
      }),
    ).toThrow(/HISTORICAL_AMOUNT_TOO_SMALL/);
  });

  it("rejects a mixed currency or price basis", () => {
    const initialPrice = observation("2026-08-03", "100");
    const finalPrice = {
      ...observation("2026-08-28", "120"),
      metadata: {
        ...initialPrice.metadata,
        priceBasis: "ADJUSTED_CLOSE" as const,
      },
    };
    expect(() =>
      calculateHistoricalInvestment({
        instrument,
        requestedAmount: Money.create("1000000.00", "COP"),
        requestedStartDate: "2026-08-03",
        requestedEndDate: "2026-08-28",
        initialPrice,
        finalPrice,
        series: series([initialPrice, finalPrice]),
      }),
    ).toThrow(/INVALID_PROVIDER_DATA/);
  });
});
