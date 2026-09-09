import { describe, expect, it } from "vitest";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import { asInstrumentId } from "@/domain/ids";
import { createFileDatasetMarketDataProvider } from "@/infrastructure/market/file-dataset-provider";

const fixedClock = { now: () => new Date("2026-09-09T13:00:00.000Z") };

async function demoProvider(): Promise<MarketDataProvider> {
  return createFileDatasetMarketDataProvider({
    datasetPath: "datasets/demo",
    manifestPath: "datasets/demo/manifest.json",
    clock: fixedClock,
  });
}

const DEMO1 = "a1b2c3d4-0001-4a01-9a01-000000000001";
const DEMOUSD = "a1b2c3d4-0004-4a04-9a04-000000000004";

describe("INST-001/MDATA-001: dataset provider contract", () => {
  it("lists instruments with complete metadata and demo provenance", async () => {
    const provider = await demoProvider();
    const page = await provider.listInstruments({}, undefined, 100);
    expect(page.items).toHaveLength(4);
    const first = page.items[0]!;
    expect(first.instrument.symbol).toBe("DEMO1");
    expect(first.instrument.currency).toBe("COP");
    expect(first.metadata.mode).toBe("demo");
    expect(first.metadata.providerId).toBe("bolsasim-demo");
    expect(first.metadata.coverageFrom).toBe("2026-08-03");
    expect(first.metadata.coverageTo).toBe("2026-08-28");
  });

  it("filters by status and paginates with an opaque stable cursor", async () => {
    const provider = await demoProvider();
    const active = await provider.listInstruments(
      { status: "ACTIVE" },
      undefined,
      2,
    );
    expect(active.items).toHaveLength(2);
    expect(active.nextCursor).toBeTruthy();
    const second = await provider.listInstruments(
      { status: "ACTIVE" },
      active.nextCursor ?? "",
      2,
    );
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(
      second.items.some((entry) =>
        active.items.some(
          (first) => first.instrument.id === entry.instrument.id,
        ),
      ),
    ).toBe(false);
  });

  it("searches by symbol or name and reports empty results explicitly", async () => {
    const provider = await demoProvider();
    const match = await provider.searchInstruments("dolarizada");
    expect(match.items.map((entry) => entry.instrument.symbol)).toEqual([
      "DEMOUSD",
    ]);
    const bySymbol = await provider.searchInstruments("DEMO2");
    expect(bySymbol.items.map((entry) => entry.instrument.symbol)).toEqual([
      "DEMO2",
    ]);
    const empty = await provider.searchInstruments("ZZZZZ");
    expect(empty.items).toEqual([]);
    expect(empty.nextCursor).toBeNull();
  });

  it("exposes the latest close with session, currency, basis and metadata", async () => {
    const provider = await demoProvider();
    const latest = await provider.getLatestPrice(
      asInstrumentId(DEMO1),
      "UNADJUSTED_CLOSE",
    );
    expect(latest.sessionDate).toBe("2026-08-28");
    expect(latest.close).toBe("120");
    expect(latest.currency).toBe("COP");
    expect(latest.metadata.priceBasis).toBe("UNADJUSTED_CLOSE");
    expect(latest.metadata.mode).toBe("demo");
  });

  it("resolves weekends directionally without interpolating sessions", async () => {
    const provider = await demoProvider();
    const before = await provider.getPriceOnDate(
      asInstrumentId(DEMO1),
      "2026-08-08",
      "ON_OR_BEFORE",
      "UNADJUSTED_CLOSE",
    );
    expect(before.sessionDate).toBe("2026-08-07");
    const after = await provider.getPriceOnDate(
      asInstrumentId(DEMO1),
      "2026-08-08",
      "ON_OR_AFTER",
      "UNADJUSTED_CLOSE",
    );
    expect(after.sessionDate).toBe("2026-08-10");
  });

  it("resolves the internal coverage gap without inventing a session", async () => {
    const provider = await demoProvider();
    const previous = await provider.getPriceOnDate(
      asInstrumentId(DEMO1),
      "2026-08-12",
      "ON_OR_BEFORE",
      "UNADJUSTED_CLOSE",
    );
    expect(previous.sessionDate).toBe("2026-08-11");
    const next = await provider.getPriceOnDate(
      asInstrumentId(DEMO1),
      "2026-08-12",
      "ON_OR_AFTER",
      "UNADJUSTED_CLOSE",
    );
    expect(next.sessionDate).toBe("2026-08-13");
  });

  it("fails explicitly outside coverage, on bad ranges and on unsupported bases", async () => {
    const provider = await demoProvider();
    const id = asInstrumentId(DEMO1);
    await expect(
      provider.getPriceOnDate(
        id,
        "2026-07-31",
        "ON_OR_AFTER",
        "UNADJUSTED_CLOSE",
      ),
    ).rejects.toMatchObject({ code: "COVERAGE_INSUFFICIENT" });
    await expect(
      provider.getHistoricalSeries(
        id,
        "2026-08-28",
        "2026-08-03",
        "UNADJUSTED_CLOSE",
      ),
    ).rejects.toMatchObject({ code: "INVALID_DATE_RANGE" });
    await expect(
      provider.getLatestPrice(id, "ADJUSTED_CLOSE"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_PRICE_BASIS" });
    await expect(
      provider.getInstrument(asInstrumentId(crypto.randomUUID())),
    ).rejects.toMatchObject({ code: "INSTRUMENT_NOT_FOUND" });
  });

  it("returns an explicit error instead of an empty array for instrument gaps", async () => {
    const provider = await demoProvider();
    await expect(
      provider.getHistoricalSeries(
        asInstrumentId(DEMOUSD),
        "2026-08-03",
        "2026-08-10",
        "UNADJUSTED_CLOSE",
      ),
    ).rejects.toMatchObject({ code: "NO_MARKET_DATA" });
  });
});

describe("MDATA-002: the file adapter validates manifest and checksums", () => {
  it("rejects a tampered dataset at construction", async () => {
    const { mkdtempSync, writeFileSync, readFileSync } =
      await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const temp = mkdtempSync(join(tmpdir(), "bolsasim-dataset-"));
    for (const file of ["instruments.json", "prices.json", "manifest.json"]) {
      writeFileSync(
        join(temp, file),
        readFileSync(join("datasets/demo", file)),
      );
    }
    writeFileSync(
      join(temp, "prices.json"),
      readFileSync(join("datasets/demo/prices.json"), "utf8").replace(
        '"105.12500000"',
        '"105.50000000"',
      ),
    );
    await expect(
      createFileDatasetMarketDataProvider({
        datasetPath: temp,
        manifestPath: join(temp, "manifest.json"),
        clock: fixedClock,
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_INVALID" });
  });
});
