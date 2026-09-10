import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { PortfolioRepository } from "@/application/ports/portfolio-repository";
import { DomainError } from "@/domain/errors";
import type { Transaction } from "@/domain/transaction";

export function createListPortfolioTransactions(dependencies: {
  repository: PortfolioRepository;
  currentUser: CurrentUserProvider;
}) {
  return {
    async execute(input: {
      cursor?: string;
      limit: number;
    }): Promise<{ items: readonly Transaction[]; nextCursor: string | null }> {
      const portfolio = await dependencies.repository.findByOwner(
        dependencies.currentUser.currentUserId(),
      );
      if (!portfolio)
        throw new DomainError(
          "PORTFOLIO_NOT_INITIALIZED",
          "El portafolio no ha sido inicializado.",
        );
      const ordered = [...portfolio.ledger].sort(
        (a, b) =>
          b.ledgerSequence - a.ledgerSequence ||
          b.executedAt.getTime() - a.executedAt.getTime(),
      );
      const afterId = input.cursor ? atob(input.cursor) : null;
      const start = afterId
        ? ordered.findIndex((entry) => entry.id === afterId) + 1
        : 0;
      if (start < 0)
        throw new DomainError("INVALID_QUERY", "El cursor es inválido.");
      const items = ordered.slice(start, start + input.limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          last && start + items.length < ordered.length ? btoa(last.id) : null,
      };
    },
  };
}
