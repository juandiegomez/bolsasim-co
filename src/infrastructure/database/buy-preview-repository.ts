import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { BuyPreviewRepository } from "@/application/ports/buy-preview-repository";
import type { BuyPreview } from "@/domain/buy-preview";
import { DomainError } from "@/domain/errors";
import { asInstrumentId, asTransactionId } from "@/domain/ids";
import { Money } from "@/domain/money";
import { Quantity } from "@/domain/quantity";
import { createBuy, type Transaction } from "@/domain/transaction";
import { UnitPrice } from "@/domain/unit-price";
import { buyPreviews, portfolios, transactions } from "./schema";

interface PgUniqueViolation {
  code?: string;
  constraint?: string;
  cause?: unknown;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current = error as PgUniqueViolation | undefined;
  while (current) {
    if (
      current.code === "23505" &&
      (current.constraint ?? "").includes(constraint)
    ) {
      return true;
    }
    current = current.cause as PgUniqueViolation | undefined;
  }
  return false;
}

function mapTransaction(row: typeof transactions.$inferSelect): Transaction {
  if (
    row.type !== "BUY" ||
    !row.instrumentId ||
    !row.quantity ||
    !row.unitPrice ||
    !row.marketSessionDate ||
    !row.marketData ||
    !row.idempotencyKey
  )
    throw new DomainError(
      "CORRUPT_LEDGER",
      "La compra persistida es inválida.",
    );
  return createBuy({
    transactionId: asTransactionId(row.id),
    portfolioId: row.portfolioId as never,
    instrumentId: asInstrumentId(row.instrumentId),
    quantity: Quantity.create(row.quantity),
    unitPrice: UnitPrice.create(row.unitPrice, "COP"),
    grossAmount: Money.create(row.grossAmount, "COP"),
    fees: Money.create(row.fees, "COP"),
    executedAt: row.executedAt,
    marketSessionDate: row.marketSessionDate,
    marketData: row.marketData as never,
    idempotencyKey: row.idempotencyKey,
    ledgerSequence: row.ledgerSequence,
  });
}

export function createDrizzleBuyPreviewRepository(
  database: NodePgDatabase<Record<string, never>>,
): BuyPreviewRepository {
  return {
    async create(preview: BuyPreview): Promise<void> {
      await database.insert(buyPreviews).values({
        id: preview.id,
        portfolioId: preview.portfolioId,
        instrumentId: preview.instrument.id,
        requestedAmount: preview.requestedAmount.toString(),
        currency: preview.requestedAmount.currency,
        unitPrice: preview.price.close,
        quantity: preview.quantity.toString(),
        grossAmount: preview.grossAmount.toString(),
        fees: preview.fees.toString(),
        totalDebit: preview.totalDebit.toString(),
        availableCash: preview.availableCash.toString(),
        marketSessionDate: preview.price.sessionDate,
        marketData: preview.price.metadata,
        expiresAt: preview.expiresAt,
        createdAt: preview.createdAt,
      });
    },
    async confirm(input) {
      return database.transaction(async (tx) => {
        await tx.execute(
          sql`select id from ${portfolios} where id = ${input.portfolioId} for update`,
        );
        const preview = (
          await tx
            .select()
            .from(buyPreviews)
            .where(eq(buyPreviews.id, input.previewId))
            .limit(1)
        )[0];
        if (!preview || preview.portfolioId !== input.portfolioId) {
          throw new DomainError(
            "PREVIEW_NOT_FOUND",
            "La previsualización no existe.",
          );
        }
        if (preview.idempotencyKey) {
          if (preview.idempotencyKey !== input.idempotencyKey) {
            throw new DomainError(
              "PREVIEW_ALREADY_USED",
              "La previsualización ya fue consumida con otra clave.",
            );
          }
          if (!preview.transactionId) {
            throw new DomainError(
              "CORRUPT_LEDGER",
              "La previsualización consumida no tiene compra registrada.",
            );
          }
          const existing = (
            await tx
              .select()
              .from(transactions)
              .where(eq(transactions.id, preview.transactionId))
              .limit(1)
          )[0];
          if (!existing)
            throw new DomainError(
              "CORRUPT_LEDGER",
              "No existe la compra confirmada.",
            );
          return { transaction: mapTransaction(existing), replayed: true };
        }
        if (preview.expiresAt.getTime() <= input.now.getTime()) {
          throw new DomainError(
            "PREVIEW_EXPIRED",
            "La previsualización venció.",
          );
        }
        const cash = await tx.execute(
          sql`select coalesce(sum(case when type = 'INITIAL_DEPOSIT' then gross_amount else -(gross_amount + fees) end), 0)::numeric as cash from ${transactions} where portfolio_id = ${input.portfolioId}`,
        );
        if (
          Money.create(
            String(cash.rows[0]?.cash ?? "0"),
            "COP",
          ).amount.lessThan(preview.totalDebit)
        ) {
          throw new DomainError(
            "INSUFFICIENT_FUNDS",
            "El efectivo disponible es insuficiente.",
          );
        }
        try {
          await tx.insert(transactions).values({
            id: input.transactionId,
            portfolioId: input.portfolioId,
            type: "BUY",
            instrumentId: preview.instrumentId,
            quantity: preview.quantity,
            unitPrice: preview.unitPrice,
            grossAmount: preview.grossAmount,
            fees: preview.fees,
            currency: preview.currency,
            executedAt: input.now,
            marketSessionDate: preview.marketSessionDate,
            marketData: preview.marketData,
            source: "USER_SIMULATION",
            idempotencyKey: input.idempotencyKey,
            createdAt: input.now,
          });
        } catch (error) {
          if (isUniqueViolation(error, "transactions_idempotency_key_unique")) {
            throw new DomainError(
              "IDEMPOTENCY_CONFLICT",
              "La clave pertenece a otra operación.",
            );
          }
          throw error;
        }
        await tx
          .update(buyPreviews)
          .set({
            consumedAt: input.now,
            transactionId: input.transactionId,
            idempotencyKey: input.idempotencyKey,
          })
          .where(eq(buyPreviews.id, input.previewId));
        const inserted = (
          await tx
            .select()
            .from(transactions)
            .where(eq(transactions.id, input.transactionId))
            .limit(1)
        )[0];
        if (!inserted)
          throw new DomainError(
            "CORRUPT_LEDGER",
            "No se pudo leer la compra confirmada.",
          );
        return { transaction: mapTransaction(inserted), replayed: false };
      });
    },
  };
}
