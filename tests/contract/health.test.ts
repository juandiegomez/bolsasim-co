import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/health/route";
import { handleRequest } from "@/infrastructure/http/handle-request";
import { createLogger } from "@/infrastructure/logging/logger";

const document = parse(readFileSync("docs/api/openapi.yaml", "utf8"));
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const health = ajv.compile(document.components.schemas.Health);
const problem = ajv.compile(document.components.schemas.Problem);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("FND-001/OBS-001: HTTP contract", () => {
  it("returns OpenAPI health and correlation without a live database", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://unused:unused@127.0.0.1:1/not_connected",
    );
    const log = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const response = await GET(
      new Request("http://localhost/api/v1/health", {
        headers: { "X-Request-Id": "contract-1" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(health(body), JSON.stringify(health.errors)).toBe(true);
    expect(body.requestId).toBe("contract-1");
    expect(response.headers.get("X-Request-Id")).toBe("contract-1");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"contract-1"'),
    );
  });
  it("rejects mutations with a documented Problem", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://unused:unused@127.0.0.1:1/not_connected",
    );
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const response = await POST(
      new Request("http://localhost/api/v1/health", { method: "POST" }),
    );
    expect(response.status).toBe(405);
    expect(problem(await response.json())).toBe(true);
    expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
  });
  it("sanitizes unexpected errors and correlates the error log", async () => {
    const lines: string[] = [];
    const response = await handleRequest(
      new Request("http://localhost/", {
        headers: { "X-Request-Id": "error-1" },
      }),
      () => {
        throw new Error("postgresql://secret:password@private/db");
      },
      createLogger("info", (line) => lines.push(line)),
    );
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(problem(body), JSON.stringify(problem.errors)).toBe(true);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.requestId).toBe("error-1");
    expect(JSON.stringify({ body, lines })).not.toMatch(/password|private\/db/);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      errorCode: "INTERNAL_ERROR",
      category: "unexpected",
      requestId: "error-1",
    });
  });
});
