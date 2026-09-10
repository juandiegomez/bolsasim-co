import type { Instrument } from "./instrument";
import type { PreviewId, PortfolioId } from "./ids";
import type { PriceObservation } from "./market";
import type { Money } from "./money";
import type { Quantity } from "./quantity";

export interface BuyPreview {
  readonly id: PreviewId;
  readonly portfolioId: PortfolioId;
  readonly instrument: Instrument;
  readonly requestedAmount: Money;
  readonly price: PriceObservation;
  readonly quantity: Quantity;
  readonly grossAmount: Money;
  readonly remainder: Money;
  readonly fees: Money;
  readonly totalDebit: Money;
  readonly availableCash: Money;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}
