import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import {
  createGetHistoricalSeries,
  createGetInstrumentDetail,
  createGetLatestPrice,
  createListInstruments,
} from "@/application/use-cases/market-queries";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import { createFileDatasetMarketDataProvider } from "@/infrastructure/market/file-dataset-provider";
import { createMarketHandlers } from "@/infrastructure/http/market-handlers";

const document = parse(readFileSync("docs/api/openapi.yaml", "utf8"));
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);

function compile(name: string) {
  return ajv.compile({
    ...document,
    allOf: [{ $ref: `#/components/schemas/${name}` }],
  });
}

const instrumentValidator = compile("Instrument");
const instrumentPageValidator = compile("InstrumentPage");
const priceValidator = compile("PriceObservation");
const seriesValidator = compile("HistoricalSeries");
const problem = compile("Problem");

async function handlers() {
  const provider: MarketDataProvider =
    await createFileDatasetMarketDataProvider({
      datasetPath: "datasets/demo",
      manifestPath: "datasets/demo/manifest.json",
      clock: { now: () => new Date("2026-09-09T13:00:00.000Z") },
    });
  return createMarketHandlers(
    {
      list: createListInstruments({ provider }),
      detail: createGetInstrumentDetail({ provider }),
      latestPrice: createGetLatestPrice({ provider }),
      series: createGetHistoricalSeries({ provider }),
    },
    { log: () => {} },
  );
}

const DEMO1 = "a1b2c3d4-0001-4a01-9a01-000000000001";
const context = (instrumentId: string) => ({
  params: Promise.resolve({ instrumentId }),
});

describe("INST-001/MDATA-001/PERF-001: market HTTP contract", () => {
  it("GET /instruments returns a valid OpenAPI page with provenance", async () => {
    const response = await (
      await handlers()
    ).list(
      new Request("http://localhost/api/v1/instruments?limit=2", {
        headers: { "X-Request-Id": "contract-market" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(
      instrumentPageValidator(body),
      JSON.stringify(instrumentPageValidator.errors),
    ).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBeTruthy();
    expect(body.items[0]).toMatchObject({
      symbol: "DEMO1",
      currency: "COP",
      dataMode: "demo",
    });
    expect(response.headers.get("x-request-id")).toBe("contract-market");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("GET /instruments?query filters and supports empty searches", async () => {
    const market = await handlers();
    const match = await market.list(
      new Request("http://localhost/api/v1/instruments?query=dolarizada"),
    );
    expect((await match.json()).items[0].symbol).toBe("DEMOUSD");
    const empty = await market.list(
      new Request("http://localhost/api/v1/instruments?query=ZZZZ"),
    );
    const emptyBody = await empty.json();
    expect(empty.status).toBe(200);
    expect(emptyBody).toEqual({ items: [], nextCursor: null });
  });

  it("GET instrument detail, price and history validate against OpenAPI", async () => {
    const market = await handlers();
    const detail = await market.detail(
      new Request(`http://localhost/api/v1/instruments/${DEMO1}`),
      context(DEMO1),
    );
    expect(detail.status).toBe(200);
    expect(instrumentValidator(await detail.json())).toBe(true);
    const price = await market.latestPrice(
      new Request(`http://localhost/api/v1/instruments/${DEMO1}/price`),
      context(DEMO1),
    );
    expect(price.status).toBe(200);
    const priceBody = await price.json();
    expect(
      priceValidator(priceBody),
      JSON.stringify(priceValidator.errors),
    ).toBe(true);
    expect(priceBody.close).toBe("120");
    expect(priceBody.metadata.mode).toBe("demo");
    const series = await market.series(
      new Request(
        `http://localhost/api/v1/instruments/${DEMO1}/history?from=2026-08-03&to=2026-08-28`,
      ),
      context(DEMO1),
    );
    expect(series.status).toBe(200);
    const seriesBody = await series.json();
    expect(
      seriesValidator(seriesBody),
      JSON.stringify(seriesValidator.errors),
    ).toBe(true);
    const dates = seriesBody.observations.map(
      (entry: { sessionDate: string }) => entry.sessionDate,
    );
    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("fails explicitly with documented Problems", async () => {
    const market = await handlers();
    const missing = await market.detail(
      new Request(
        `http://localhost/api/v1/instruments/ffffffff-ffff-4fff-8fff-ffffffffffff`,
      ),
      context("ffffffff-ffff-4fff-8fff-ffffffffffff"),
    );
    expect(missing.status).toBe(404);
    const missingBody = await missing.json();
    expect(problem(missingBody), JSON.stringify(problem.errors)).toBe(true);
    expect(missingBody.code).toBe("INSTRUMENT_NOT_FOUND");
    const badRange = await market.series(
      new Request(
        `http://localhost/api/v1/instruments/${DEMO1}/history?from=2026-08-28&to=2026-08-03`,
      ),
      context(DEMO1),
    );
    expect(badRange.status).toBe(400);
    expect((await badRange.json()).code).toBe("INVALID_DATE_RANGE");
    const badBasis = await market.latestPrice(
      new Request(
        `http://localhost/api/v1/instruments/${DEMO1}/price?priceBasis=INTRADAY`,
      ),
      context(DEMO1),
    );
    expect(badBasis.status).toBe(400);
    expect((await badBasis.json()).code).toBe("UNSUPPORTED_PRICE_BASIS");
    const outsideCoverage = await market.series(
      new Request(
        `http://localhost/api/v1/instruments/${DEMO1}/history?from=2026-07-01&to=2026-08-28`,
      ),
      context(DEMO1),
    );
    expect(outsideCoverage.status).toBe(422);
    expect((await outsideCoverage.json()).code).toBe("COVERAGE_INSUFFICIENT");
  });

  it("rejects mutations with a documented Problem", async () => {
    const market = await handlers();
    const response = await market.methodNotAllowed("GET")(
      new Request("http://localhost/api/v1/instruments", { method: "POST" }),
    );
    expect(response.status).toBe(405);
    expect(problem(await response.json())).toBe(true);
  });
});
