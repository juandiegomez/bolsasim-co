import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  getTestDatabaseUrl,
  parseEnvironment,
} from "@/infrastructure/config/env";

const valid = {
  DATABASE_URL: "postgresql://local:example@127.0.0.1:5432/bolsasim",
};

describe("FND-001: validated configuration", () => {
  it("returns typed defaults without reserved business settings", () => {
    expect(
      parseEnvironment({ ...valid, INITIAL_DEPOSIT_COP: "unused" }),
    ).toEqual({
      ...valid,
      APP_TIME_ZONE: "America/Bogota",
      LOG_LEVEL: "info",
    });
  });
  it.each([
    {},
    { DATABASE_URL: "https://secret-password@example.com/database" },
    { DATABASE_URL: "postgresql://localhost" },
    { ...valid, LOG_LEVEL: "verbose" },
    { ...valid, APP_TIME_ZONE: "UTC" },
  ])("rejects invalid configuration without echoing values: %j", (input) => {
    expect(() => parseEnvironment(input)).toThrow(ConfigurationError);
    try {
      parseEnvironment(input);
    } catch (error) {
      expect(String(error)).not.toContain("secret-password");
      expect(String(error)).toContain("CONFIGURATION_INVALID");
    }
  });
  it("requires a dedicated test database without fallback", () => {
    expect(() => getTestDatabaseUrl(valid)).toThrow("TEST_DATABASE_URL");
    expect(() =>
      getTestDatabaseUrl({ TEST_DATABASE_URL: valid.DATABASE_URL }),
    ).toThrow("TEST_DATABASE_URL");
    expect(
      getTestDatabaseUrl({ TEST_DATABASE_URL: `${valid.DATABASE_URL}_test` }),
    ).toBe(`${valid.DATABASE_URL}_test`);
  });
});
