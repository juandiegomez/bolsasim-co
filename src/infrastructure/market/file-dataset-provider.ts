import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Clock } from "@/application/ports/clock";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import { ConfigurationError } from "@/infrastructure/config/env";
import {
  createDatasetMarketDataProvider,
  type DatasetObservation,
  type DatasetPayload,
} from "./dataset-provider";
import type { PriceBasis } from "@/domain/instrument";
import type { DataMode } from "@/domain/market";

interface ManifestFile {
  [fileName: string]: string;
}

interface DatasetManifest {
  manifestVersion: number;
  providerId: string;
  mode: DataMode;
  source: {
    name: string;
    url: string | null;
    owner: string;
    terms: string;
  };
  downloadedAt: string;
  cutoffDate: string;
  files: ManifestFile;
  timezone: string;
  currency: string | null;
  currencies?: string[];
  frequency: string;
  priceDefinition: {
    field: string;
    basis: string[];
    adjustment: string;
  };
  transformations: string[];
  limitations: string[];
}

export interface FileDatasetOptions {
  datasetPath: string;
  manifestPath: string;
  clock: Clock;
}

export async function createFileDatasetMarketDataProvider(
  options: FileDatasetOptions,
): Promise<MarketDataProvider> {
  let manifest: DatasetManifest;
  let instruments: unknown;
  let prices: unknown;
  try {
    manifest = JSON.parse(
      await readFile(options.manifestPath, "utf8"),
    ) as DatasetManifest;
    instruments = JSON.parse(
      await readFile(
        path.join(options.datasetPath, "instruments.json"),
        "utf8",
      ),
    );
    prices = JSON.parse(
      await readFile(path.join(options.datasetPath, "prices.json"), "utf8"),
    );
  } catch (error) {
    throw new ConfigurationError([
      `MARKET_DATA_FILE_PATH (${String(error instanceof Error ? error.message : error)})`,
    ]);
  }

  if (manifest.manifestVersion !== 1 || !manifest.providerId) {
    throw new ConfigurationError([
      "MARKET_DATA_MANIFEST_PATH (manifestVersion/providerId)",
    ]);
  }
  if (manifest.mode !== "real" && manifest.mode !== "demo") {
    throw new ConfigurationError(["MARKET_DATA_MANIFEST_PATH (mode)"]);
  }

  for (const [fileName, expected] of Object.entries(manifest.files ?? {})) {
    try {
      const bytes = await readFile(path.join(options.datasetPath, fileName));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== expected) {
        throw new ConfigurationError([
          `MARKET_DATA_MANIFEST_PATH (checksum mismatch for ${fileName})`,
        ]);
      }
    } catch (error) {
      if (error instanceof ConfigurationError) throw error;
      throw new ConfigurationError([
        `MARKET_DATA_MANIFEST_PATH (${fileName} unreadable)`,
      ]);
    }
  }

  const payload = instruments as DatasetPayload;
  const observations =
    (prices as { observations?: DatasetObservation[] }).observations ?? [];
  const basis = manifest.priceDefinition?.basis ?? ["UNADJUSTED_CLOSE"];
  const descriptor = {
    providerId: manifest.providerId,
    mode: manifest.mode,
    basis: basis as readonly PriceBasis[],
    adjustedPricePolicy: manifest.priceDefinition?.adjustment ?? "",
    limitations: manifest.limitations ?? [],
  };
  return createDatasetMarketDataProvider(
    { instruments: payload.instruments ?? [], observations },
    descriptor,
    options.clock,
  );
}
