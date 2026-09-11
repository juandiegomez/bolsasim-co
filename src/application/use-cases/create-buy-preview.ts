import type { BuyPreviewRepository } from "@/application/ports/buy-preview-repository";
import type { Clock } from "@/application/ports/clock";
import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import type { PortfolioRepository } from "@/application/ports/portfolio-repository";
import type { BuyPreview } from "@/domain/buy-preview";
import { DomainError } from "@/domain/errors";
import type { InstrumentId, PreviewId } from "@/domain/ids";
import type { Money } from "@/domain/money";
import { projectLedger } from "@/domain/portfolio-projector";
import { calculatePurchase } from "@/domain/purchase-calculator";
import { UnitPrice } from "@/domain/unit-price";

export function createCreateBuyPreview(dependencies: {
  repository: PortfolioRepository;
  previews: BuyPreviewRepository;
  provider: MarketDataProvider;
  currentUser: CurrentUserProvider;
  clock: Clock;
  initialDeposit: Money;
  createPreviewId: () => PreviewId;
}) {
  return {
    async execute(input: {
      instrumentId: InstrumentId;
      amount: Money;
    }): Promise<BuyPreview> {
      const portfolio = await dependencies.repository.findByOwner(
        dependencies.currentUser.currentUserId(),
      );
      if (!portfolio) {
        throw new DomainError(
          "PORTFOLIO_NOT_INITIALIZED",
          "El portafolio no ha sido inicializado.",
        );
      }
      const record = await dependencies.provider.getInstrument(
        input.instrumentId,
      );
      if (input.amount.currency !== dependencies.initialDeposit.currency) {
        throw new DomainError(
          "CURRENCY_MISMATCH",
          "El monto debe coincidir con la moneda de liquidación del portafolio.",
        );
      }
      if (
        record.instrument.type !== "EQUITY" ||
        record.instrument.status !== "ACTIVE"
      ) {
        throw new DomainError(
          "INSTRUMENT_NOT_TRADABLE",
          "El instrumento no es operable en el MVP.",
        );
      }
      if (record.instrument.currency !== dependencies.initialDeposit.currency) {
        throw new DomainError(
          "CURRENCY_MISMATCH",
          "La moneda del instrumento no coincide con la del portafolio.",
        );
      }
      const price = await dependencies.provider.getLatestPrice(
        input.instrumentId,
        "UNADJUSTED_CLOSE",
      );
      if (price.currency !== record.instrument.currency) {
        throw new DomainError(
          "INVALID_PROVIDER_DATA",
          "El precio no coincide con la moneda del instrumento.",
        );
      }
      const calculation = calculatePurchase(
        input.amount,
        UnitPrice.create(price.close, price.currency),
      );
      const availableCash = projectLedger(
        portfolio.ledger,
        dependencies.initialDeposit,
      ).cash;
      if (calculation.totalDebit.amount.greaterThan(availableCash.amount)) {
        throw new DomainError(
          "INSUFFICIENT_FUNDS",
          "El efectivo disponible es insuficiente.",
        );
      }
      const createdAt = dependencies.clock.now();
      const preview: BuyPreview = {
        id: dependencies.createPreviewId(),
        portfolioId: portfolio.portfolioId,
        instrument: record.instrument,
        requestedAmount: input.amount,
        price,
        quantity: calculation.quantity,
        grossAmount: calculation.grossAmount,
        remainder: calculation.remainder,
        fees: calculation.fees,
        totalDebit: calculation.totalDebit,
        availableCash,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
      };
      await dependencies.previews.create(preview);
      return preview;
    },
  };
}
