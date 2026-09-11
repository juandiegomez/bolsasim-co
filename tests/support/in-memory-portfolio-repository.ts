import type {
  InitializedPortfolio,
  PortfolioRepository,
  ScenarioSummary,
} from "@/application/ports/portfolio-repository";
import { DomainError } from "@/domain/errors";
import {
  asPortfolioId,
  asTransactionId,
  type PortfolioId,
  type UserId,
} from "@/domain/ids";
import type { Money } from "@/domain/money";
import {
  createInitialDeposit,
  createVoidBuy,
  type Transaction,
} from "@/domain/transaction";

export function createInMemoryPortfolioRepository(): PortfolioRepository {
  const scenarios = new Map<string, PortfolioId[]>();
  const ledgers = new Map<PortfolioId, Transaction[]>();
  const metadata = new Map<PortfolioId, ScenarioSummary>();

  function active(ownerId: UserId) {
    return (scenarios.get(ownerId) ?? [])
      .map((id) => metadata.get(id)!)
      .find((scenario) => scenario.status === "ACTIVE");
  }

  function initialized(portfolioId: PortfolioId): InitializedPortfolio {
    const scenario = metadata.get(portfolioId)!;
    return { ...scenario, ledger: ledgers.get(portfolioId) ?? [] };
  }

  function create(
    ownerId: UserId,
    label: string,
    deposit: Money,
    executedAt: Date,
  ) {
    const portfolioId = asPortfolioId(crypto.randomUUID());
    const summary: ScenarioSummary = {
      portfolioId,
      label,
      status: "ACTIVE",
      createdAt: executedAt,
      archivedAt: null,
    };
    scenarios.set(ownerId, [...(scenarios.get(ownerId) ?? []), portfolioId]);
    metadata.set(portfolioId, summary);
    ledgers.set(portfolioId, [
      createInitialDeposit({
        transactionId: asTransactionId(crypto.randomUUID()),
        portfolioId,
        deposit,
        executedAt,
        createdAt: executedAt,
      }),
    ]);
    return initialized(portfolioId);
  }

  return {
    async initializeForOwner(ownerId, deposit, executedAt) {
      const current = active(ownerId);
      return current
        ? initialized(current.portfolioId)
        : create(ownerId, "Práctica inicial", deposit, executedAt);
    },
    async findByOwner(ownerId) {
      const current = active(ownerId);
      return current ? initialized(current.portfolioId) : null;
    },
    async listScenarios(ownerId) {
      return (scenarios.get(ownerId) ?? []).map((id) => metadata.get(id)!);
    },
    async resetForOwner(ownerId, deposit, executedAt) {
      const current = active(ownerId);
      const archived = current
        ? (() => {
            const next = {
              ...current,
              status: "ARCHIVED" as const,
              archivedAt: executedAt,
            };
            metadata.set(current.portfolioId, next);
            return initialized(current.portfolioId);
          })()
        : null;
      const count = (scenarios.get(ownerId) ?? []).length + 1;
      return {
        archived,
        active: create(ownerId, `Práctica ${count}`, deposit, executedAt),
      };
    },
    async voidBuy(ownerId, transactionId, executedAt) {
      const current = active(ownerId);
      if (!current)
        throw new DomainError(
          "PORTFOLIO_NOT_INITIALIZED",
          "El portafolio no ha sido inicializado.",
        );
      const ledger = ledgers.get(current.portfolioId)!;
      const target = ledger.find((entry) => entry.id === transactionId);
      if (!target)
        throw new DomainError("BUY_NOT_FOUND", "La compra no existe.");
      if (target.type !== "BUY")
        throw new DomainError(
          "INVALID_VOID_TARGET",
          "El movimiento no es una compra.",
        );
      if (
        ledger.some((entry) => entry.reversalOfTransactionId === transactionId)
      ) {
        throw new DomainError(
          "BUY_ALREADY_VOIDED",
          "La compra ya fue revertida.",
        );
      }
      ledger.push(
        createVoidBuy({
          transactionId: asTransactionId(crypto.randomUUID()),
          portfolioId: current.portfolioId,
          reversalOfTransactionId: transactionId,
          currency: "COP",
          executedAt,
        }),
      );
      return initialized(current.portfolioId);
    },
  };
}
