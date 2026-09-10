import type { BuyPreviewRepository } from "@/application/ports/buy-preview-repository";
import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { PortfolioRepository } from "@/application/ports/portfolio-repository";
import { DomainError } from "@/domain/errors";
import type { PreviewId, TransactionId } from "@/domain/ids";

export function createConfirmBuyPreview(dependencies: {
  previews: BuyPreviewRepository;
  portfolios: PortfolioRepository;
  currentUser: CurrentUserProvider;
  clock: Clock;
  createTransactionId: () => TransactionId;
}) {
  return {
    async execute(input: { previewId: PreviewId; idempotencyKey: string }) {
      const portfolio = await dependencies.portfolios.findByOwner(
        dependencies.currentUser.currentUserId(),
      );
      if (!portfolio) {
        throw new DomainError(
          "PORTFOLIO_NOT_INITIALIZED",
          "El portafolio no ha sido inicializado.",
        );
      }
      return dependencies.previews.confirm({
        previewId: input.previewId,
        portfolioId: portfolio.portfolioId,
        idempotencyKey: input.idempotencyKey,
        now: dependencies.clock.now(),
        transactionId: dependencies.createTransactionId(),
      });
    },
  };
}
