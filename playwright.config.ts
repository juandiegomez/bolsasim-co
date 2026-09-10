import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

nextEnv.loadEnvConfig(process.cwd());

// E2E runs against a dedicated database (E2E_DATABASE_URL) so the persistent
// development database is never mutated by tests. CI keeps DATABASE_URL fresh
// per run; locally, point E2E_DATABASE_URL at a dedicated *_test database.
const serverEnv = process.env.E2E_DATABASE_URL
  ? { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL }
  : process.env;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://127.0.0.1:3100/api/v1/health",
    reuseExistingServer: false,
    timeout: 60000,
    env: serverEnv as Record<string, string>,
  },
});
