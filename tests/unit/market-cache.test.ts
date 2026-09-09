import { describe, expect, it } from "vitest";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import { DomainError } from "@/domain/errors";
import type { InstrumentRecord, Page, PriceObservation } from "@/domain/market";
import { asInstrumentId } from "@/domain/ids";
import { createCachedMarketProvider } from "@/infrastructure/market/cache/cached-market-provider";

class FakeClock {
  private currentMs = Date.UTC(2026, 8, 9, 13, 0, 0);
  now(): Date {
    return new Date(this.currentMs);
  }
  advance(seconds: number) {
    this.currentMs += seconds * 1000;
  }
}

function fakeProvider(calls: { counted: string[] }): MarketDataProvider {
  const record: InstrumentRecord = {
    instrument: {
      id: asInstrumentId("a1b2c3d4-0001-4a01-9a01-000000000001"),
      symbol: "DEMO1",
      name: "Demo",
      exchange: "BVC",
      currency: "COP",
      type: "EQUITY",
      status: "ACTIVE",
    },
    metadata: {
      providerId: "test",
      mode: "demo",
      retrievedAt: new Date(0),
      priceBasis: "UNADJUSTED_CLOSE",
      coverageFrom: null,
      coverageTo: null,
      adjustedPricePolicy: "",
      limitations: [],
    },
  };
  const observation: PriceObservation = {
    instrumentId: record.instrument.id,
    sessionDate: "2026-08-28",
    close: "120.00",
    currency: "COP",
    metadata: record.metadata,
  };
  const page: Page<InstrumentRecord> = { items: [record], nextCursor: null };
  return {
    async listInstruments() {
      calls.counted.push("list");
      return page;
    },
    async searchInstruments() {
      calls.counted.push("search");
      return page;
    },
    async getInstrument() {
      calls.counted.push("getInstrument");
      return record;
    },
    async getLatestPrice() {
      calls.counted.push("getLatestPrice");
      return observation;
    },
    async getPriceOnDate() {
      calls.counted.push("getPriceOnDate");
      return observation;
    },
    async getHistoricalSeries() {
      calls.counted.push("getHistoricalSeries");
      return {
        instrumentId: record.instrument.id,
        observations: [observation],
        metadata: record.metadata,
      };
    },
  };
}

describe("PERF-001: in-process market cache behind the same interface", () => {
  const clock = new FakeClock();
  function build(calls: { counted: string[] }) {
    return {
      calls,
      cached: createCachedMarketProvider(fakeProvider(calls), {
        clock,
        recentTtlSeconds: 300,
        historicalTtlSeconds: 86400,
      }),
    };
  }

  it("reuses equivalent recent requests within the TTL", async () => {
    const { cached, calls } = build({ counted: [] });
    const id = asInstrumentId(crypto.randomUUID());
    await cached.getLatestPrice(id, "UNADJUSTED_CLOSE");
    await cached.getLatestPrice(id, "UNADJUSTED_CLOSE");
    expect(calls.counted).toEqual(["getLatestPrice"]);
    clock.advance(299);
    await cached.getLatestPrice(id, "UNADJUSTED_CLOSE");
    expect(calls.counted).toEqual(["getLatestPrice"]);
  });

  it("expires the recent TTL after five minutes", async () => {
    const { cached, calls } = build({ counted: [] });
    const id = asInstrumentId(crypto.randomUUID());
    await cached.getLatestPrice(id, "UNADJUSTED_CLOSE");
    clock.advance(301);
    await cached.getLatestPrice(id, "UNADJUSTED_CLOSE");
    expect(calls.counted).toEqual(["getLatestPrice", "getLatestPrice"]);
  });

  it("never masks a provider failure as an empty result", async () => {
    const unknownId = asInstrumentId(crypto.randomUUID());
    let attempts = 0;
    const wrapped = createCachedMarketProvider(
      {
        ...fakeProvider({ counted: [] }),
        getInstrument: async () => {
          attempts += 1;
          throw Object.assign(new Error("missing"), {
            code: "INSTRUMENT_NOT_FOUND",
          });
        },
      },
      { clock, recentTtlSeconds: 300, historicalTtlSeconds: 86400 },
    );
    await expect(wrapped.getInstrument(unknownId)).rejects.toMatchObject({
      code: "INSTRUMENT_NOT_FOUND",
    });
    await expect(wrapped.getInstrument(unknownId)).rejects.toMatchObject({
      code: "INSTRUMENT_NOT_FOUND",
    });
    expect(attempts).toBe(2);
  });

  it("keeps historical series for twenty-four hours", async () => {
    const { cached, calls } = build({ counted: [] });
    const id = asInstrumentId(crypto.randomUUID());
    await cached.getHistoricalSeries(
      id,
      "2026-08-03",
      "2026-08-28",
      "UNADJUSTED_CLOSE",
    );
    clock.advance(3600 * 23);
    await cached.getHistoricalSeries(
      id,
      "2026-08-03",
      "2026-08-28",
      "UNADJUSTED_CLOSE",
    );
    expect(calls.counted).toEqual(["getHistoricalSeries"]);
    clock.advance(3600 * 2);
    await cached.getHistoricalSeries(
      id,
      "2026-08-03",
      "2026-08-28",
      "UNADJUSTED_CLOSE",
    );
    expect(calls.counted).toEqual([
      "getHistoricalSeries",
      "getHistoricalSeries",
    ]);
  });

  it("caches retriable failures briefly and never caches other errors", async () => {
    const clock2 = new FakeClock();
    let attempts = 0;
    const instrumentId = asInstrumentId(crypto.randomUUID());
    const wrapped = createCachedMarketProvider(
      {
        ...fakeProvider({ counted: [] }),
        getLatestPrice: async () => {
          attempts += 1;
          throw new DomainError("PROVIDER_UNAVAILABLE", "down");
        },
      },
      { clock: clock2, recentTtlSeconds: 300, historicalTtlSeconds: 86400 },
    );
    await expect(
      wrapped.getLatestPrice(instrumentId, "UNADJUSTED_CLOSE"),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(
      wrapped.getLatestPrice(instrumentId, "UNADJUSTED_CLOSE"),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(attempts).toBe(1);
  });

  it("never masks a provider failure as an empty result", async () => {
    const unknownId = asInstrumentId(crypto.randomUUID());
    let attempts = 0;
    const wrapped = createCachedMarketProvider(
      {
        ...fakeProvider({ counted: [] }),
        getInstrument: async () => {
          attempts += 1;
          throw new DomainError("INSTRUMENT_NOT_FOUND", "missing");
        },
      },
      { clock, recentTtlSeconds: 300, historicalTtlSeconds: 86400 },
    );
    await expect(wrapped.getInstrument(unknownId)).rejects.toMatchObject({
      code: "INSTRUMENT_NOT_FOUND",
    });
    await expect(wrapped.getInstrument(unknownId)).rejects.toMatchObject({
      code: "INSTRUMENT_NOT_FOUND",
    });
    expect(attempts).toBe(2);
  });
});
