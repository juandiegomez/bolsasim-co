import { describe, expect, it } from "vitest";
import { createLogger } from "@/infrastructure/logging/logger";
import { resolveRequestId } from "@/infrastructure/http/request-id";

describe("OBS-001 (Slice 0): structured logging and request IDs", () => {
  it("allows only defined fields and respects level", () => {
    const lines: string[] = [];
    const logger = createLogger(
      "info",
      (line) => lines.push(line),
      () => new Date("2026-09-05T12:00:00Z"),
    );
    logger.log({ level: "debug", event: "hidden" });
    const event = {
      level: "error" as const,
      event: "http.failed",
      requestId: "test-1",
      password: "secret",
      error: new Error("secret-url"),
    };
    logger.log(event);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      timestamp: "2026-09-05T12:00:00.000Z",
      level: "error",
      event: "http.failed",
      requestId: "test-1",
    });
    expect(lines[0]).not.toContain("secret");
  });
  it("propagates valid IDs and replaces unsafe or missing IDs", () => {
    expect(resolveRequestId("request-1.test_ok")).toBe("request-1.test_ok");
    for (const invalid of [
      null,
      "",
      "a".repeat(129),
      "bad\nheader",
      "<script>",
    ]) {
      expect(resolveRequestId(invalid)).toMatch(/^[a-f0-9-]{36}$/);
    }
  });
});
