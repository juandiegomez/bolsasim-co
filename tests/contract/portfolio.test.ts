import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { createGetPortfolioSnapshot } from "@/application/use-cases/get-portfolio-snapshot";
import { createInitializePortfolio } from "@/application/use-cases/initialize-portfolio";
import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import { asUserId } from "@/domain/ids";
import { Money } from "@/domain/money";
import { createPortfolioHandlers } from "@/infrastructure/http/portfolio-handlers";
import { createInMemoryPortfolioRepository } from "../support/in-memory-portfolio-repository";

const document = parse(readFileSync("docs/api/openapi.yaml", "utf8"));
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const snapshotValidator = ajv.compile({
  ...document,
  allOf: [{ $ref: "#/components/schemas/PortfolioSnapshot" }],
});
const problem = ajv.compile({
  ...document,
  allOf: [{ $ref: "#/components/schemas/Problem" }],
});

const ownerId = asUserId("00000000-0000-0000-0000-000000000001");
const initialDeposit = Money.create("10000000.00", "COP");
const asOf = new Date("2026-09-09T13:00:00.000Z");
const clock: Clock = { now: () => asOf };
const currentUser: CurrentUserProvider = { currentUserId: () => ownerId };

function handlersWith(initialized: boolean) {
  const repository = createInMemoryPortfolioRepository();
  if (initialized) {
    repository.initializeForOwner(ownerId, initialDeposit, asOf);
  }
  const initialize = createInitializePortfolio({
    repository,
    currentUser,
    clock,
    initialDeposit,
  });
  const snapshot = createGetPortfolioSnapshot({
    repository,
    currentUser,
    clock,
    initialDeposit,
  });
  return createPortfolioHandlers({ initialize, snapshot }, { log: () => {} });
}

const request = () =>
  new Request("http://localhost/api/v1", {
    headers: { "X-Request-Id": "contract-portfolio" },
  });

describe("PORT-001/PORT-002: portfolio HTTP contract", () => {
  it("POST /portfolios/initialize returns a valid OpenAPI snapshot", async () => {
    const response = await handlersWith(false).initialize(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(
      snapshotValidator(body),
      JSON.stringify(snapshotValidator.errors),
    ).toBe(true);
    expect(body.cash).toEqual({ amount: "10000000.00", currency: "COP" });
    expect(body.valuationStatus).toBe("COMPLETE");
    expect(response.headers.get("x-request-id")).toBe("contract-portfolio");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("repeated initialize returns the existing snapshot", async () => {
    const handlers = handlersWith(false);
    const first = await handlers.initialize(request());
    const second = await handlers.initialize(request());
    expect((await first.json()).portfolioId).toBe(
      (await second.json()).portfolioId,
    );
  });
  it("GET /portfolio returns a valid snapshot after initialization", async () => {
    const response = await handlersWith(true).snapshot(request());
    expect(response.status).toBe(200);
    expect(snapshotValidator(await response.json())).toBe(true);
  });
  it("GET /portfolio without initialization returns a documented Problem", async () => {
    const response = await handlersWith(false).snapshot(request());
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(problem(body), JSON.stringify(problem.errors)).toBe(true);
    expect(body.code).toBe("PORTFOLIO_NOT_INITIALIZED");
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
  });
  it("rejects mutations on the read route with a documented Problem", async () => {
    const response = await handlersWith(true).methodNotAllowed("GET")(
      new Request("http://localhost/api/v1/portfolio", { method: "POST" }),
    );
    expect(response.status).toBe(405);
    expect(problem(await response.json())).toBe(true);
  });
});
