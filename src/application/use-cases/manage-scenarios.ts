import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { PortfolioRepository } from "@/application/ports/portfolio-repository";
import type { Money } from "@/domain/money";
import type { TransactionId } from "@/domain/ids";

export function createListScenarios(dependencies: {
  repository: PortfolioRepository;
  currentUser: CurrentUserProvider;
}) {
  return {
    execute() {
      return dependencies.repository.listScenarios(
        dependencies.currentUser.currentUserId(),
      );
    },
  };
}

export function createResetScenario(dependencies: {
  repository: PortfolioRepository;
  currentUser: CurrentUserProvider;
  clock: Clock;
  initialDeposit: Money;
}) {
  return {
    execute() {
      return dependencies.repository.resetForOwner(
        dependencies.currentUser.currentUserId(),
        dependencies.initialDeposit,
        dependencies.clock.now(),
      );
    },
  };
}

export function createVoidBuy(dependencies: {
  repository: PortfolioRepository;
  currentUser: CurrentUserProvider;
  clock: Clock;
}) {
  return {
    execute(transactionId: TransactionId) {
      return dependencies.repository.voidBuy(
        dependencies.currentUser.currentUserId(),
        transactionId,
        dependencies.clock.now(),
      );
    },
  };
}
