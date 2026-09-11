import nextEnv from "@next/env";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { currentMarketDate, isDatasetStale } from "./market-date";

nextEnv.loadEnvConfig(process.cwd());

const NEXT_BIN = path.resolve("node_modules/next/dist/bin/next");
const REFRESH_MARKER = ".demo-refresh.json";

interface RefreshMarker {
  marketDate: string;
  attemptedAt: string;
}

interface DatasetManifest {
  cutoffDate?: unknown;
}

function datasetPath(): string {
  return path.resolve(
    process.env.MARKET_DATA_FILE_PATH?.trim() ||
      process.env.MARKET_DATA_REAL_PATH?.trim() ||
      "datasets/real",
  );
}

function manifestPath(datasetDirectory: string): string {
  return path.resolve(
    process.env.MARKET_DATA_MANIFEST_PATH?.trim() ||
      path.join(datasetDirectory, "manifest.json"),
  );
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

async function wasRefreshAttempted(
  markerPath: string,
  marketDate: string,
): Promise<boolean> {
  const marker = await readJson<RefreshMarker>(markerPath);
  return marker?.marketDate === marketDate;
}

function runNpmScript(script: string): Promise<void> {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["run", script], {
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${script} terminó con ${signal ? `señal ${signal}` : `código ${code ?? "desconocido"}`}.`,
        ),
      );
    });
  });
}

async function refreshRealDatasetIfNeeded(): Promise<void> {
  if (process.env.MARKET_DATA_ADAPTER !== "file") {
    console.log(
      "Modo demo detectado: se conserva el dataset demo y no se consulta Twelve Data.",
    );
    return;
  }
  if (process.env.MARKET_DATA_AUTO_REFRESH === "false") {
    console.log("Actualización automática desactivada por configuración.");
    return;
  }

  const directory = datasetPath();
  const marketDate = currentMarketDate();
  const manifest = await readJson<DatasetManifest>(manifestPath(directory));
  const cutoffDate =
    typeof manifest?.cutoffDate === "string" ? manifest.cutoffDate : undefined;

  if (!isDatasetStale(cutoffDate, marketDate)) {
    console.log(
      `Dataset real vigente hasta ${cutoffDate}; no se necesita actualizarlo hoy.`,
    );
    return;
  }

  const markerPath = path.join(directory, REFRESH_MARKER);
  if (await wasRefreshAttempted(markerPath, marketDate)) {
    console.log(
      `La actualización de Twelve Data ya se intentó para ${marketDate}; se conserva el snapshot disponible.`,
    );
    return;
  }

  if (!process.env.TWELVE_DATA_API_KEY) {
    console.warn(
      "No hay TWELVE_DATA_API_KEY: se conserva el último dataset real disponible.",
    );
    return;
  }

  await mkdir(directory, { recursive: true });
  await writeFile(
    markerPath,
    `${JSON.stringify({ marketDate, attemptedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Dataset real desactualizado (${cutoffDate ?? "sin snapshot"}); intentando actualizar hasta ${marketDate}.`,
  );
  try {
    await runNpmScript("market:ingest");
    await runNpmScript("market:verify");
    console.log("Dataset real actualizado y verificado.");
  } catch (error) {
    console.warn(
      `No fue posible actualizar Twelve Data; se conserva el último snapshot válido. ${error instanceof Error ? error.message : "Error desconocido."}`,
    );
  }
}

function startNext(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [NEXT_BIN, "dev", "--hostname", "127.0.0.1"],
      { env: process.env, stdio: "inherit" },
    );
    const forwardSignal = (signal: NodeJS.Signals) => child.kill(signal);
    process.once("SIGINT", () => forwardSignal("SIGINT"));
    process.once("SIGTERM", () => forwardSignal("SIGTERM"));
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
        resolve();
        return;
      }
      reject(
        new Error(
          `Next.js terminó con ${signal ? `señal ${signal}` : `código ${code ?? "desconocido"}`}.`,
        ),
      );
    });
  });
}

async function main(): Promise<void> {
  await refreshRealDatasetIfNeeded();
  await startNext();
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "No fue posible iniciar la demo.",
  );
  process.exitCode = 1;
});
