import nextEnv from "@next/env";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { currentMarketDate } from "./market-date";

nextEnv.loadEnvConfig(process.cwd());

const TWELVE_DATA_URL = "https://api.twelvedata.com/time_series";
const START_DATE = process.env.TWELVE_DATA_START_DATE ?? "2020-01-01";
const END_DATE = process.env.TWELVE_DATA_END_DATE ?? currentMarketDate();
const OUTPUT_DIR = path.resolve(
  process.env.MARKET_DATA_REAL_PATH?.trim() ||
    process.env.MARKET_DATA_FILE_PATH?.trim() ||
    "datasets/real",
);
const MANIFEST_PATH = path.resolve(
  process.env.MARKET_DATA_MANIFEST_PATH?.trim() ||
    path.join(OUTPUT_DIR, "manifest.json"),
);
const API_KEY = process.env.TWELVE_DATA_API_KEY;

const SAMPLE = [
  {
    id: "a1b2c3d4-1001-4a01-9a01-000000000001",
    symbol: "AAPL",
    exchange: "NASDAQ",
    name: "Apple Inc.",
  },
  {
    id: "a1b2c3d4-1001-4a01-9a01-000000000002",
    symbol: "MSFT",
    exchange: "NASDAQ",
    name: "Microsoft Corporation",
  },
  {
    id: "a1b2c3d4-1001-4a01-9a01-000000000003",
    symbol: "KO",
    exchange: "NYSE",
    name: "The Coca-Cola Company",
  },
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface TwelveDataMeta {
  symbol?: unknown;
  name?: unknown;
  exchange?: unknown;
  mic_code?: unknown;
  currency?: unknown;
  exchange_timezone?: unknown;
  interval?: unknown;
  type?: unknown;
}

interface TwelveDataValue {
  datetime?: unknown;
  close?: unknown;
}

interface TwelveDataPayload {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  meta?: TwelveDataMeta;
  values?: TwelveDataValue[];
}

interface NormalizedInstrument {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: "USD";
  type: "EQUITY";
  status: "ACTIVE";
}

interface NormalizedObservation {
  instrumentId: string;
  sessionDate: string;
  close: string;
  currency: "USD";
}

function fail(message: string): never {
  throw new Error(message);
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

function assertDateRange(): void {
  if (!isValidDate(START_DATE) || !isValidDate(END_DATE)) {
    fail(
      "TWELVE_DATA_START_DATE/TWELVE_DATA_END_DATE deben usar YYYY-MM-DD y ser fechas válidas.",
    );
  }
  if (START_DATE > END_DATE) {
    fail(
      "TWELVE_DATA_START_DATE no puede ser posterior a TWELVE_DATA_END_DATE.",
    );
  }
}

function asNonEmptyString(
  value: unknown,
  field: string,
  symbol: string,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`Respuesta inválida de Twelve Data para ${symbol}: falta ${field}.`);
  }
  return value;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function fetchSeries(sample: (typeof SAMPLE)[number]): Promise<{
  instrument: NormalizedInstrument;
  observations: NormalizedObservation[];
  timezone: string;
  points: number;
}> {
  const query = new URLSearchParams({
    symbol: sample.symbol,
    exchange: sample.exchange,
    interval: "1day",
    start_date: START_DATE,
    end_date: END_DATE,
    adjust: "none",
    format: "JSON",
    apikey: API_KEY!,
  });
  const response = await fetch(`${TWELVE_DATA_URL}?${query.toString()}`);
  let payload: TwelveDataPayload;
  try {
    payload = JSON.parse(await response.text()) as TwelveDataPayload;
  } catch {
    fail(`Twelve Data devolvió una respuesta no JSON para ${sample.symbol}.`);
  }

  if (!response.ok || payload.status === "error" || payload.code) {
    const code = typeof payload.code === "number" ? ` (${payload.code})` : "";
    const message =
      typeof payload.message === "string" ? ` ${payload.message}` : "";
    fail(`Twelve Data rechazó ${sample.symbol}.${code}${message}`);
  }

  const meta = payload.meta;
  const values = payload.values;
  const symbol = sample.symbol;
  const responseSymbol = asNonEmptyString(meta?.symbol, "meta.symbol", symbol);
  const exchange = asNonEmptyString(meta?.exchange, "meta.exchange", symbol);
  const micCode = asNonEmptyString(meta?.mic_code, "meta.mic_code", symbol);
  const currency = asNonEmptyString(meta?.currency, "meta.currency", symbol);
  const timezone = asNonEmptyString(
    meta?.exchange_timezone,
    "meta.exchange_timezone",
    symbol,
  );
  const interval = asNonEmptyString(meta?.interval, "meta.interval", symbol);
  const type = asNonEmptyString(meta?.type, "meta.type", symbol);

  if (responseSymbol.toUpperCase() !== symbol) {
    fail(`Respuesta de Twelve Data para ${symbol} devolvió otro símbolo.`);
  }
  if (exchange !== sample.exchange || !micCode.startsWith("X")) {
    fail(`Metadata de mercado inconsistente para ${symbol}.`);
  }
  if (currency !== "USD" || interval !== "1day" || !/stock/i.test(type)) {
    fail(`Metadata no compatible con Equity USD diaria para ${symbol}.`);
  }
  if (!Array.isArray(values) || values.length === 0) {
    fail(`Twelve Data no devolvió observaciones para ${symbol}.`);
  }

  const observations = values.map((value) => {
    const sessionDate = asNonEmptyString(value.datetime, "datetime", symbol);
    const close = asNonEmptyString(value.close, "close", symbol);
    if (
      !isValidDate(sessionDate) ||
      sessionDate < START_DATE ||
      sessionDate > END_DATE
    ) {
      fail(`Fecha fuera de rango o inválida para ${symbol}: ${sessionDate}.`);
    }
    const decimal = new Decimal(close);
    if (
      !decimal.isFinite() ||
      !decimal.isPositive() ||
      decimal.decimalPlaces() > 8
    ) {
      fail(`Cierre inválido para ${symbol} en ${sessionDate}.`);
    }
    return {
      instrumentId: sample.id,
      sessionDate,
      close,
      currency: "USD" as const,
    };
  });

  observations.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  for (let index = 1; index < observations.length; index += 1) {
    if (
      observations[index]!.sessionDate === observations[index - 1]!.sessionDate
    ) {
      fail(
        `Fecha duplicada para ${symbol}: ${observations[index]!.sessionDate}.`,
      );
    }
  }

  const providerName =
    typeof meta?.name === "string" && meta.name.trim() !== ""
      ? meta.name
      : sample.name;
  return {
    instrument: {
      id: sample.id,
      symbol,
      name: providerName,
      exchange,
      currency: "USD",
      type: "EQUITY",
      status: "ACTIVE",
    },
    observations,
    timezone,
    points: observations.length,
  };
}

async function main(): Promise<void> {
  if (!API_KEY) {
    fail(
      "Falta TWELVE_DATA_API_KEY. Configúrala solo en .env local; nunca la publiques ni la pongas en NEXT_PUBLIC_*.",
    );
  }
  assertDateRange();

  const results = [];
  for (const sample of SAMPLE) {
    const result = await fetchSeries(sample);
    results.push(result);
    console.log(
      `${result.instrument.symbol}: ${result.points} observaciones, ${result.instrument.exchange}/${result.timezone}.`,
    );
  }

  const timezones = new Set(results.map((result) => result.timezone));
  if (timezones.size !== 1) {
    fail("Las series no comparten una zona horaria de mercado única.");
  }

  const instruments = results.map((result) => result.instrument);
  const observations = results.flatMap((result) => result.observations);
  const instrumentsContent = jsonFile({ instruments });
  const pricesContent = jsonFile({ observations });
  const coverageFrom = observations
    .map((observation) => observation.sessionDate)
    .sort()[0];
  const coverageTo = observations
    .map((observation) => observation.sessionDate)
    .sort()
    .at(-1);
  if (!coverageFrom || !coverageTo) {
    fail("El dataset no tiene cobertura temporal.");
  }

  const downloadedAt = new Date().toISOString();
  const manifestContent = jsonFile({
    manifestVersion: 1,
    providerId: "twelve-data-local",
    mode: "real",
    source: {
      name: "Twelve Data",
      url: TWELVE_DATA_URL,
      owner: "Twelve Data",
      terms:
        "Uso local educativo, no comercial y no productivo sujeto a la cuenta, plan y términos vigentes de Twelve Data; no redistribuir.",
    },
    downloadedAt,
    cutoffDate: coverageTo,
    files: {
      "instruments.json": sha256(instrumentsContent),
      "prices.json": sha256(pricesContent),
    },
    timezone: [...timezones][0],
    currency: "USD",
    currencies: ["USD"],
    frequency: "daily",
    priceDefinition: {
      field: "close",
      basis: ["UNADJUSTED_CLOSE"],
      adjustment:
        "adjust=none: cierre diario sin ajustes por splits ni dividendos.",
    },
    transformations: [
      "Se conservaron únicamente symbol, name, exchange, currency y tipo Equity.",
      "Se normalizó datetime a sessionDate YYYY-MM-DD y close a decimal textual.",
      `Rango solicitado: ${START_DATE} a ${END_DATE}; las series se ordenaron ascendentemente.`,
    ],
    limitations: [
      "Dataset local derivado de una muestra accesible para la cuenta evaluada; no implica cobertura total ni permanente.",
      "La disponibilidad, cuota, cobertura, licencia y fecha de corte dependen de Twelve Data.",
      "Es una fuente real histórica para una demo educativa; no es recomendación, asesoría ni ejecución de órdenes.",
      "No incluye dividendos, splits, FX, crypto ni otros eventos corporativos.",
      "No redistribuir los datos ni exhibirlos comercialmente a terceros.",
    ],
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, "instruments.json"),
    instrumentsContent,
    "utf8",
  );
  await writeFile(path.join(OUTPUT_DIR, "prices.json"), pricesContent, "utf8");
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, manifestContent, "utf8");

  console.log(
    `Dataset real local generado en ${path.relative(process.cwd(), OUTPUT_DIR) || "."}: ${instruments.length} instrumentos, ${observations.length} observaciones, cobertura ${coverageFrom} a ${coverageTo}.`,
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Falló la ingesta de Twelve Data.",
  );
  process.exitCode = 1;
});
