import { and, asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import type {
  InitializedPortfolio,
  PortfolioRepository,
} from "@/application/ports/portfolio-repository";
import { DomainError } from "@/domain/errors";
import {
  asPortfolioId,
  asTransactionId,
  type PortfolioId,
  type UserId,
} from "@/domain/ids";
import { Money, type Currency } from "@/domain/money";
import { Quantity } from "@/domain/quantity";
import { UnitPrice } from "@/domain/unit-price";
import {
  createBuy,
  createInitialDeposit,
  type Transaction,
} from "@/domain/transaction";
import { asInstrumentId } from "@/domain/ids";
import { PersistenceError } from "./errors";
import { portfolios, transactions, users } from "./schema";

function corrupt(detail: string): DomainError {
  return new DomainError(
    "CORRUPT_LEDGER",
    `Secuencia de ledger inválida: ${detail}`,
  );
}

interface TransactionRow {
  id: string;
  portfolioId: string;
  type: string;
  instrumentId: string | null;
  quantity: string | null;
  unitPrice: string | null;
  grossAmount: string;
  fees: string;
  currency: string;
  executedAt: Date;
  marketSessionDate: string | null;
  marketData: unknown | null;
  source: string;
  idempotencyKey: string | null;
  createdAt: Date;
  ledgerSequence: number;
}

type InitialDepositRow = TransactionRow & {
  type: "INITIAL_DEPOSIT";
  source: "SYSTEM_INITIALIZATION";
};

function isInitialDepositRow(row: TransactionRow): row is InitialDepositRow {
  return (
    row.type === "INITIAL_DEPOSIT" && row.source === "SYSTEM_INITIALIZATION"
  );
}

function mapRowToTransaction(row: TransactionRow): Transaction {
  if (row.type === "BUY") {
    if (
      !row.instrumentId ||
      !row.quantity ||
      !row.unitPrice ||
      !row.marketSessionDate ||
      !row.marketData ||
      !row.idempotencyKey ||
      row.source !== "USER_SIMULATION"
    ) {
      throw corrupt("la compra no contiene todos los campos requeridos");
    }
    const currency = validateCurrency(row.currency);
    return createBuy({
      transactionId: asTransactionId(row.id),
      portfolioId: asPortfolioId(row.portfolioId),
      instrumentId: asInstrumentId(row.instrumentId),
      quantity: Quantity.create(row.quantity),
      unitPrice: UnitPrice.create(row.unitPrice, currency),
      grossAmount: Money.create(row.grossAmount, currency),
      fees: Money.create(row.fees, currency),
      executedAt: row.executedAt,
      marketSessionDate: row.marketSessionDate,
      marketData: row.marketData as never,
      idempotencyKey: row.idempotencyKey,
      ledgerSequence: row.ledgerSequence,
    });
  }
  if (!isInitialDepositRow(row))
    throw corrupt(`tipo de movimiento no reconocido (${row.type})`);
  if (
    row.instrumentId !== null ||
    row.quantity !== null ||
    row.unitPrice !== null ||
    row.marketSessionDate !== null ||
    row.idempotencyKey !== null
  ) {
    throw corrupt(
      "el depósito inicial no debe tener instrumento, cantidad, precio, sesión ni clave de idempotencia",
    );
  }
  const currency = validateCurrency(row.currency);
  return createInitialDeposit({
    transactionId: asTransactionId(row.id),
    portfolioId: asPortfolioId(row.portfolioId),
    deposit: Money.create(row.grossAmount, currency),
    executedAt: row.executedAt,
    createdAt: row.createdAt,
    ledgerSequence: row.ledgerSequence,
  });
}

function validateCurrency(value: string): Currency {
  if (value !== "COP") {
    throw corrupt(`moneda no soportada en el MVP: ${value}`);
  }
  return value;
}

function ledgerQuery(
  database: NodePgDatabase<Record<string, never>>,
  portfolioId: PortfolioId,
) {
  return database
    .select()
    .from(transactions)
    .where(eq(transactions.portfolioId, portfolioId))
    .orderBy(asc(transactions.ledgerSequence));
}

async function mapLedger(
  database: NodePgDatabase<Record<string, never>>,
  portfolioId: PortfolioId,
): Promise<Transaction[]> {
  const rows: TransactionRow[] = await ledgerQuery(database, portfolioId);
  return rows.map(mapRowToTransaction);
}

export function createDrizzlePortfolioRepository(
  database: NodePgDatabase<Record<string, never>>,
): PortfolioRepository {
  async function findPortfolioIdByOwner(
    ownerId: UserId,
  ): Promise<PortfolioId | null> {
    const rows = await database
      .select({ id: portfolios.id })
      .from(portfolios)
      .where(eq(portfolios.ownerId, ownerId))
      .limit(1);
    const portfolioId = rows[0]?.id;
    return portfolioId ? asPortfolioId(portfolioId) : null;
  }

  return {
    async initializeForOwner(
      ownerId: UserId,
      deposit: Money,
      executedAt: Date,
    ): Promise<InitializedPortfolio> {
      return database.transaction(async (tx) => {
        await tx.insert(users).values({ id: ownerId }).onConflictDoNothing();
        await tx
          .insert(portfolios)
          .values({ ownerId, baseCurrency: deposit.currency })
          .onConflictDoNothing();
        const portfolioRows = await tx
          .select({ id: portfolios.id })
          .from(portfolios)
          .where(eq(portfolios.ownerId, ownerId))
          .limit(1);
        const portfolioId = portfolioRows[0]?.id;
        if (!portfolioId) {
          throw new PersistenceError(
            "DATABASE_UNAVAILABLE",
            "El portafolio no pudo leerse durante la inicialización.",
          );
        }
        const existingDeposit = await tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.portfolioId, asPortfolioId(portfolioId)),
              eq(transactions.type, "INITIAL_DEPOSIT"),
            ),
          )
          .limit(1);
        if (existingDeposit.length === 0) {
          await tx.insert(transactions).values({
            id: randomUUID(),
            portfolioId: asPortfolioId(portfolioId),
            type: "INITIAL_DEPOSIT",
            grossAmount: deposit.amount.toFixed(2),
            fees: "0.00",
            currency: deposit.currency,
            executedAt,
            source: "SYSTEM_INITIALIZATION",
            createdAt: executedAt,
          });
        }
        const ledger = await mapLedger(
          tx as unknown as NodePgDatabase<Record<string, never>>,
          asPortfolioId(portfolioId),
        );
        return { portfolioId: asPortfolioId(portfolioId), ledger };
      });
    },
    async findByOwner(ownerId: UserId): Promise<InitializedPortfolio | null> {
      const portfolioId = await findPortfolioIdByOwner(ownerId);
      if (!portfolioId) return null;
      return {
        portfolioId,
        ledger: await mapLedger(database, portfolioId),
      };
    },
  };
}
