import { randomUUID } from "node:crypto";
import { createCreateBuyPreview } from "@/application/use-cases/create-buy-preview";
import { createConfirmBuyPreview } from "@/application/use-cases/confirm-buy-preview";
import { createGetPortfolioSnapshot } from "@/application/use-cases/get-portfolio-snapshot";
import { asPreviewId, asTransactionId, asUserId } from "@/domain/ids";
import { Money } from "@/domain/money";
import { createSystemClock } from "@/infrastructure/clock/system-clock";
import { getEnvironment } from "@/infrastructure/config/env";
import { createDrizzleBuyPreviewRepository } from "@/infrastructure/database/buy-preview-repository";
import { getApplicationDatabase } from "@/infrastructure/database/singleton";
import { createDrizzlePortfolioRepository } from "@/infrastructure/database/portfolio-repository";
import { createLocalUserProvider } from "@/infrastructure/identity/local-user-provider";
import { createLogger } from "@/infrastructure/logging/logger";
import { getMarketDataProvider } from "@/infrastructure/market/provider";

export async function createDefaultTradingRouteDependencies() {
  const environment = getEnvironment();
  const database = getApplicationDatabase();
  const portfolios = createDrizzlePortfolioRepository(database.db);
  const previews = createDrizzleBuyPreviewRepository(database.db);
  const clock = createSystemClock();
  const currentUser = createLocalUserProvider(
    asUserId(environment.DEMO_USER_ID),
  );
  const initialDeposit = Money.create(environment.INITIAL_DEPOSIT_COP, "COP");
  const preview = createCreateBuyPreview({
    repository: portfolios,
    previews,
    provider: await getMarketDataProvider(),
    currentUser,
    clock,
    initialDeposit,
    createPreviewId: () => asPreviewId(randomUUID()),
  });
  const confirm = createConfirmBuyPreview({
    previews,
    portfolios,
    currentUser,
    clock,
    createTransactionId: () => asTransactionId(randomUUID()),
  });
  const snapshot = createGetPortfolioSnapshot({
    repository: portfolios,
    currentUser,
    clock,
    initialDeposit,
  });
  return {
    useCases: { preview, confirm, snapshot },
    logger: createLogger(environment.LOG_LEVEL),
  } as const;
}
