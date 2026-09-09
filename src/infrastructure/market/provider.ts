import path from "node:path";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import { getEnvironment } from "@/infrastructure/config/env";
import { createSystemClock } from "@/infrastructure/clock/system-clock";
import { createCachedMarketProvider } from "./cache/cached-market-provider";
import { createFileDatasetMarketDataProvider } from "./file-dataset-provider";

let instancePromise: Promise<MarketDataProvider> | undefined;

async function build(): Promise<MarketDataProvider> {
  const environment = getEnvironment();
  const clock = createSystemClock();
  const inner =
    environment.MARKET_DATA_ADAPTER === "file"
      ? await createFileDatasetMarketDataProvider({
          datasetPath: environment.MARKET_DATA_FILE_PATH ?? "",
          manifestPath: environment.MARKET_DATA_MANIFEST_PATH ?? "",
          clock,
        })
      : await createFileDatasetMarketDataProvider({
          datasetPath: path.resolve("datasets/demo"),
          manifestPath: path.resolve("datasets/demo/manifest.json"),
          clock,
        });
  return createCachedMarketProvider(inner, {
    clock,
    recentTtlSeconds: environment.MARKET_DATA_RECENT_TTL_SECONDS,
    historicalTtlSeconds: environment.MARKET_DATA_HISTORICAL_TTL_SECONDS,
  });
}

// MARKET_DATA_ADAPTER=mock uses the committed demo dataset; adapter=file
// loads the configured real dataset. Neither path falls back to the other.
export function getMarketDataProvider(): Promise<MarketDataProvider> {
  instancePromise ??= build();
  return instancePromise;
}
