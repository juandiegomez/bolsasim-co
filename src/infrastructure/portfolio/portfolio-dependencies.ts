import { Money } from "@/domain/money";
import { asUserId } from "@/domain/ids";
import { getEnvironment } from "@/infrastructure/config/env";
import { createSystemClock } from "@/infrastructure/clock/system-clock";
import { createDrizzlePortfolioRepository } from "@/infrastructure/database/portfolio-repository";
import { getApplicationDatabase } from "@/infrastructure/database/singleton";
import { createLocalUserProvider } from "@/infrastructure/identity/local-user-provider";
import { createLogger } from "@/infrastructure/logging/logger";
import { createGetPortfolioSnapshot } from "@/application/use-cases/get-portfolio-snapshot";
import { createInitializePortfolio } from "@/application/use-cases/initialize-portfolio";
import { createListPortfolioTransactions } from "@/application/use-cases/list-portfolio-transactions";
import { createGetPortfolioEvolution } from "@/application/use-cases/get-portfolio-evolution";
import {
  createListScenarios,
  createResetScenario,
  createVoidBuy,
} from "@/application/use-cases/manage-scenarios";
import { getMarketDataProvider } from "@/infrastructure/market/provider";

export async function createDefaultPortfolioRouteDependencies() {
  const environment = getEnvironment();
  const database = getApplicationDatabase();
  const repository = createDrizzlePortfolioRepository(database.db);
  const clock = createSystemClock();
  const currentUser = createLocalUserProvider(
    asUserId(environment.DEMO_USER_ID),
  );
  const initialDeposit = Money.create(environment.INITIAL_DEPOSIT_COP, "COP");
  const provider = await getMarketDataProvider();
  return {
    initialize: createInitializePortfolio({
      repository,
      currentUser,
      clock,
      initialDeposit,
    }),
    snapshot: createGetPortfolioSnapshot({
      repository,
      currentUser,
      clock,
      initialDeposit,
      provider,
    }),
    transactions: createListPortfolioTransactions({ repository, currentUser }),
    evolution: createGetPortfolioEvolution({
      repository,
      provider,
      currentUser,
      initialDeposit,
    }),
    scenarios: createListScenarios({ repository, currentUser }),
    reset: createResetScenario({
      repository,
      currentUser,
      clock,
      initialDeposit,
    }),
    voidBuy: createVoidBuy({ repository, currentUser, clock }),
    logger: createLogger(environment.LOG_LEVEL),
  };
}
