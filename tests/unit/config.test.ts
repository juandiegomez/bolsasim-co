import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  getTestDatabaseUrl,
  parseEnvironment,
} from "@/infrastructure/config/env";
import { getConfiguredInitialDeposit } from "@/infrastructure/config/portfolio-profile";

const valid = {
  DATABASE_URL: "postgresql://local:example@127.0.0.1:5432/bolsasim",
};

describe("FND-001: validated configuration", () => {
  it("returns typed defaults including the configurable settlement profile", () => {
    const environment = parseEnvironment({
      ...valid,
      SETTLEMENT_CURRENCY: "USD",
      INITIAL_DEPOSIT_AMOUNT: "999.99",
    });
    expect(environment).toMatchObject({
      ...valid,
      APP_TIME_ZONE: "America/Bogota",
      LOG_LEVEL: "info",
      DEMO_USER_ID: "00000000-0000-0000-0000-000000000001",
      SETTLEMENT_CURRENCY: "USD",
      INITIAL_DEPOSIT_AMOUNT: "999.99",
      MARKET_DATA_ADAPTER: "mock",
      MARKET_DATA_RECENT_TTL_SECONDS: 300,
      MARKET_DATA_HISTORICAL_TTL_SECONDS: 86400,
    });
    expect(getConfiguredInitialDeposit(environment).currency).toBe("USD");
    expect(getConfiguredInitialDeposit(environment).toString()).toBe("999.99");
  });
  it("keeps the legacy COP deposit variable working", () => {
    const environment = parseEnvironment({
      ...valid,
      INITIAL_DEPOSIT_COP: "999.99",
    });
    expect(getConfiguredInitialDeposit(environment).toString()).toBe("999.99");
    expect(getConfiguredInitialDeposit(environment).currency).toBe("COP");
  });
  it.each([
    {},
    { DATABASE_URL: "https://secret-password@example.com/database" },
    { DATABASE_URL: "postgresql://localhost" },
    { ...valid, LOG_LEVEL: "verbose" },
    { ...valid, APP_TIME_ZONE: "UTC" },
    { ...valid, DEMO_USER_ID: "not-a-uuid" },
    { ...valid, SETTLEMENT_CURRENCY: "US" },
    { ...valid, SETTLEMENT_CURRENCY: "USD" },
    { ...valid, INITIAL_DEPOSIT_AMOUNT: "10.000000" },
    { ...valid, INITIAL_DEPOSIT_AMOUNT: "0.00" },
    { ...valid, INITIAL_DEPOSIT_AMOUNT: "abc" },
    {
      ...valid,
      INITIAL_DEPOSIT_AMOUNT: "10.00",
      INITIAL_DEPOSIT_COP: "11.00",
    },
    { ...valid, MARKET_DATA_ADAPTER: "scraper" },
    { ...valid, MARKET_DATA_ADAPTER: "file" },
    {
      ...valid,
      MARKET_DATA_ADAPTER: "mock",
      MARKET_DATA_RECENT_TTL_SECONDS: "0",
    },
  ])("rejects invalid configuration without echoing values: %j", (input) => {
    expect(() => parseEnvironment(input)).toThrow(ConfigurationError);
    try {
      parseEnvironment(input);
    } catch (error) {
      expect(String(error)).not.toContain("secret-password");
      expect(String(error)).toContain("CONFIGURATION_INVALID");
    }
  });
  it("requires a generic amount when selecting a non-COP profile", () => {
    expect(() =>
      parseEnvironment({ ...valid, SETTLEMENT_CURRENCY: "USD" }),
    ).toThrow(ConfigurationError);
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
