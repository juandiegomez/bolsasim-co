import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

describe("FND-001/OBS-001: database commands fail explicitly", () => {
  it.each([
    [
      "check",
      "https://sensitive-password@private.example/db",
      "CONFIGURATION_INVALID",
    ],
    [
      "check",
      "postgresql://local:sensitive-password@127.0.0.1:1/unreachable",
      "DATABASE_UNAVAILABLE",
    ],
    [
      "migrate",
      "postgresql://local:sensitive-password@127.0.0.1:1/unreachable",
      "MIGRATION_FAILED",
    ],
  ])(
    "%s reports %s safely as %s",
    async (command, databaseUrl, expectedCode) => {
      const result = await promisify(execFile)(
        process.execPath,
        ["--import", "tsx", "scripts/database.ts", command],
        {
          timeout: 12000,
          windowsHide: true,
          env: { ...process.env, DATABASE_URL: databaseUrl },
        },
      ).then(
        () => {
          throw new Error("Command unexpectedly succeeded");
        },
        (error: { code: number; stdout: string; stderr: string }) => error,
      );
      expect(result.code).toBe(1);
      expect(result.stdout).toContain(expectedCode);
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        "sensitive-password",
      );
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        "private.example",
      );
    },
  );
});
