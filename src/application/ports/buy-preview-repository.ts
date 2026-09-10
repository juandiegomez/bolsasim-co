import type { BuyPreview } from "@/domain/buy-preview";
import type { PortfolioId, PreviewId, TransactionId } from "@/domain/ids";
import type { Transaction } from "@/domain/transaction";

export interface ConfirmBuyPreviewInput {
  readonly previewId: PreviewId;
  readonly portfolioId: PortfolioId;
  readonly idempotencyKey: string;
  readonly now: Date;
  readonly transactionId: TransactionId;
}

export interface BuyPreviewRepository {
  create(preview: BuyPreview): Promise<void>;
  confirm(input: ConfirmBuyPreviewInput): Promise<{
    readonly transaction: Transaction;
    readonly replayed: boolean;
  }>;
}
