import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

test("FND-001: invalid configuration stops the real server without leaking secrets", async () => {
  const result = await promisify(execFile)(
    process.execPath,
    [
      path.resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "0",
    ],
    {
      timeout: 15000,
      windowsHide: true,
      env: {
        ...process.env,
        DATABASE_URL: "https://sensitive-password@private.example/db",
      },
    },
  ).then(
    () => {
      throw new Error("Server unexpectedly started");
    },
    (error: { code: number; stdout: string; stderr: string }) => error,
  );
  const output = `${result.stdout}${result.stderr}`;
  expect(result.code, output).toBe(1);
  expect(output).toContain("CONFIGURATION_INVALID");
  expect(output).not.toContain("sensitive-password");
  expect(output).not.toContain("private.example");
});
