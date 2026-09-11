import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import { createRunHistoricalSimulation } from "@/application/use-cases/run-historical-simulation";
import { createFileDatasetMarketDataProvider } from "@/infrastructure/market/file-dataset-provider";
import { createHistoricalSimulationHandlers } from "@/infrastructure/http/historical-simulation-handlers";

const document = parse(readFileSync("docs/api/openapi.yaml", "utf8"));
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);

function compile(name: string) {
  return ajv.compile({
    ...document,
    allOf: [{ $ref: `#/components/schemas/${name}` }],
  });
}

const historicalValidator = compile("HistoricalSimulation");
const problemValidator = compile("Problem");
const DEMO1 = "a1b2c3d4-0001-4a01-9a01-000000000001";

async function handler() {
  const provider: MarketDataProvider =
    await createFileDatasetMarketDataProvider({
      datasetPath: "datasets/demo",
      manifestPath: "datasets/demo/manifest.json",
      clock: { now: () => new Date("2026-09-09T13:00:00.000Z") },
    });
  return createHistoricalSimulationHandlers(
    { run: createRunHistoricalSimulation({ provider }) },
    { log: () => {} },
  );
}

describe("HIST-001/002/003/MDATA-001/002: historical simulation contract", () => {
  it("returns the exact historical result and validates against OpenAPI", async () => {
    const response = await (
      await handler()
    ).run(
      new Request("http://localhost/api/v1/historical-simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId: DEMO1,
          amount: { amount: "1000000.00", currency: "COP" },
          requestedStartDate: "2026-08-03",
          requestedEndDate: "2026-08-28",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(
      historicalValidator(body),
      JSON.stringify(historicalValidator.errors),
    ).toBe(true);
    expect(body.effectiveStartDate).toBe("2026-08-03");
    expect(body.effectiveEndDate).toBe("2026-08-28");
    expect(body.finalValue).toEqual({ amount: "1200000.00", currency: "COP" });
    expect(body.returnPct).toBe("20");
    expect(body.instrument.dataMode).toBe("demo");
  });

  it("uses the latest available session when the end date is omitted", async () => {
    const response = await (
      await handler()
    ).run(
      new Request("http://localhost/api/v1/historical-simulations", {
        method: "POST",
        body: JSON.stringify({
          instrumentId: DEMO1,
          amount: { amount: "1000000.00", currency: "COP" },
          requestedStartDate: "2026-08-08",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.effectiveStartDate).toBe("2026-08-10");
    expect(body.effectiveEndDate).toBe("2026-08-28");
  });

  it("returns a documented Problem for an invalid date range", async () => {
    const response = await (
      await handler()
    ).run(
      new Request("http://localhost/api/v1/historical-simulations", {
        method: "POST",
        body: JSON.stringify({
          instrumentId: DEMO1,
          amount: { amount: "1000000.00", currency: "COP" },
          requestedStartDate: "2026-08-28",
          requestedEndDate: "2026-08-03",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(
      problemValidator(body),
      JSON.stringify(problemValidator.errors),
    ).toBe(true);
    expect(body.code).toBe("INVALID_DATE_RANGE");
  });
});
