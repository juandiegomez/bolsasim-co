import {
  createGetHistoricalSeries,
  createGetInstrumentDetail,
  createGetLatestPrice,
  createListInstruments,
} from "@/application/use-cases/market-queries";
import { getEnvironment } from "@/infrastructure/config/env";
import { createLogger } from "@/infrastructure/logging/logger";
import { getMarketDataProvider } from "./provider";

export async function createDefaultMarketRouteDependencies() {
  const environment = getEnvironment();
  const provider = await getMarketDataProvider();
  return {
    useCases: {
      list: createListInstruments({ provider }),
      detail: createGetInstrumentDetail({ provider }),
      latestPrice: createGetLatestPrice({ provider }),
      series: createGetHistoricalSeries({ provider }),
    },
    logger: createLogger(environment.LOG_LEVEL),
  } as const;
}
