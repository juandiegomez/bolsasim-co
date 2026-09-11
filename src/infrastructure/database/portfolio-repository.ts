import { and, asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import type {
  InitializedPortfolio,
  PortfolioRepository,
  ScenarioSummary,
} from "@/application/ports/portfolio-repository";
import { DomainError } from "@/domain/errors";
import {
  asInstrumentId,
  asPortfolioId,
  asTransactionId,
  type PortfolioId,
  type UserId,
} from "@/domain/ids";
import { isCurrencyCode, Money, type Currency } from "@/domain/money";
import { Quantity } from "@/domain/quantity";
import { UnitPrice } from "@/domain/unit-price";
import {
  createBuy,
  createInitialDeposit,
  createVoidBuy,
  type Transaction,
} from "@/domain/transaction";
import { PersistenceError } from "./errors";
import { buyPreviews, portfolios, transactions, users } from "./schema";

type Database = NodePgDatabase<Record<string, never>>;
type TransactionRow = typeof transactions.$inferSelect;
type PortfolioRow = typeof portfolios.$inferSelect;

function corrupt(detail: string): DomainError {
  return new DomainError(
    "CORRUPT_LEDGER",
    `Secuencia de ledger inválida: ${detail}`,
  );
}

function validateCurrency(value: string): Currency {
  if (!isCurrencyCode(value)) throw corrupt(`moneda inválida: ${value}`);
  return value;
}

function mapRowToTransaction(row: TransactionRow): Transaction {
  const currency = validateCurrency(row.currency);
  if (row.type === "BUY") {
    if (
      !row.instrumentId ||
      !row.quantity ||
      !row.unitPrice ||
      !row.marketSessionDate ||
      !row.marketData ||
      !row.idempotencyKey ||
      row.source !== "USER_SIMULATION" ||
      row.reversalOfTransactionId !== null
    )
      throw corrupt("la compra no contiene todos los campos requeridos");
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
  if (row.type === "VOID_BUY") {
    if (
      row.source !== "USER_SIMULATION" ||
      !row.reversalOfTransactionId ||
      row.instrumentId !== null ||
      row.quantity !== null ||
      row.unitPrice !== null ||
      row.marketSessionDate !== null ||
      row.marketData !== null ||
      row.idempotencyKey !== null ||
      row.grossAmount !== "0.00" ||
      row.fees !== "0.00"
    )
      throw corrupt("la reversión persistida es inválida");
    return createVoidBuy({
      transactionId: asTransactionId(row.id),
      portfolioId: asPortfolioId(row.portfolioId),
      reversalOfTransactionId: asTransactionId(row.reversalOfTransactionId),
      currency,
      executedAt: row.executedAt,
      ledgerSequence: row.ledgerSequence,
    });
  }
  if (
    row.type !== "INITIAL_DEPOSIT" ||
    row.source !== "SYSTEM_INITIALIZATION" ||
    row.instrumentId !== null ||
    row.quantity !== null ||
    row.unitPrice !== null ||
    row.marketSessionDate !== null ||
    row.marketData !== null ||
    row.idempotencyKey !== null ||
    row.reversalOfTransactionId !== null
  )
    throw corrupt(`tipo de movimiento no reconocido (${row.type})`);
  return createInitialDeposit({
    transactionId: asTransactionId(row.id),
    portfolioId: asPortfolioId(row.portfolioId),
    deposit: Money.create(row.grossAmount, currency),
    executedAt: row.executedAt,
    createdAt: row.createdAt,
    ledgerSequence: row.ledgerSequence,
  });
}

function ledgerQuery(database: Database, portfolioId: PortfolioId) {
  return database
    .select()
    .from(transactions)
    .where(eq(transactions.portfolioId, portfolioId))
    .orderBy(asc(transactions.ledgerSequence));
}

async function mapLedger(database: Database, portfolioId: PortfolioId) {
  const rows: TransactionRow[] = await ledgerQuery(database, portfolioId);
  return rows.map(mapRowToTransaction);
}

function mapScenario(row: PortfolioRow): ScenarioSummary {
  if (row.status !== "ACTIVE" && row.status !== "ARCHIVED") {
    throw new PersistenceError(
      "DATABASE_UNAVAILABLE",
      "El estado del escenario persistido no es válido.",
    );
  }
  return {
    portfolioId: asPortfolioId(row.id),
    label: row.label,
    status: row.status,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt,
  };
}

async function mapInitialized(
  database: Database,
  row: PortfolioRow,
): Promise<InitializedPortfolio> {
  const scenario = mapScenario(row);
  return {
    ...scenario,
    ledger: await mapLedger(database, scenario.portfolioId),
  };
}

async function activeRow(database: Database, ownerId: UserId) {
  return (
    await database
      .select()
      .from(portfolios)
      .where(
        and(eq(portfolios.ownerId, ownerId), eq(portfolios.status, "ACTIVE")),
      )
      .limit(1)
  )[0] as PortfolioRow | undefined;
}

async function insertScenario(
  database: Database,
  ownerId: UserId,
  label: string,
  currency: Currency,
) {
  const inserted = await database
    .insert(portfolios)
    .values({ ownerId, baseCurrency: currency, label, status: "ACTIVE" })
    .returning();
  const row = inserted[0];
  if (!row)
    throw new PersistenceError(
      "DATABASE_UNAVAILABLE",
      "No se creó el escenario.",
    );
  return row;
}

async function appendInitialDeposit(
  database: Database,
  portfolioId: PortfolioId,
  deposit: Money,
  executedAt: Date,
) {
  await database.insert(transactions).values({
    id: randomUUID(),
    portfolioId,
    type: "INITIAL_DEPOSIT",
    grossAmount: deposit.amount.toFixed(2),
    fees: "0.00",
    currency: deposit.currency,
    executedAt,
    source: "SYSTEM_INITIALIZATION",
    createdAt: executedAt,
  });
}

export function createDrizzlePortfolioRepository(
  database: Database,
): PortfolioRepository {
  return {
    async initializeForOwner(ownerId, deposit, executedAt) {
      return database.transaction(async (tx) => {
        const db = tx as unknown as Database;
        await tx.insert(users).values({ id: ownerId }).onConflictDoNothing();
        await tx.execute(
          sql`select id from ${users} where id = ${ownerId} for update`,
        );
        const existing = await activeRow(db, ownerId);
        const row =
          existing ??
          (await insertScenario(
            db,
            ownerId,
            "Práctica inicial",
            deposit.currency,
          ));
        if (!existing)
          await appendInitialDeposit(
            db,
            asPortfolioId(row.id),
            deposit,
            executedAt,
          );
        return mapInitialized(db, row);
      });
    },

    async findByOwner(ownerId) {
      const row = await activeRow(database, ownerId);
      return row ? mapInitialized(database, row) : null;
    },

    async listScenarios(ownerId) {
      const rows = await database
        .select()
        .from(portfolios)
        .where(eq(portfolios.ownerId, ownerId))
        .orderBy(asc(portfolios.createdAt));
      return rows.map(mapScenario);
    },

    async resetForOwner(ownerId, deposit, executedAt) {
      return database.transaction(async (tx) => {
        const db = tx as unknown as Database;
        await tx.insert(users).values({ id: ownerId }).onConflictDoNothing();
        await tx.execute(
          sql`select id from ${users} where id = ${ownerId} for update`,
        );
        const current = await activeRow(db, ownerId);
        let archived: InitializedPortfolio | null = null;
        if (current) {
          await tx.execute(
            sql`select id from ${portfolios} where id = ${current.id} for update`,
          );
          await tx
            .update(buyPreviews)
            .set({ expiresAt: executedAt })
            .where(
              and(
                eq(buyPreviews.portfolioId, current.id),
                sql`${buyPreviews.consumedAt} is null`,
              ),
            );
          await tx
            .update(portfolios)
            .set({ status: "ARCHIVED", archivedAt: executedAt })
            .where(eq(portfolios.id, current.id));
          archived = await mapInitialized(db, {
            ...current,
            status: "ARCHIVED",
            archivedAt: executedAt,
          });
        }
        const count =
          (
            await db
              .select({ count: sql<number>`count(*)` })
              .from(portfolios)
              .where(eq(portfolios.ownerId, ownerId))
          )[0]?.count ?? 1;
        const fresh = await insertScenario(
          db,
          ownerId,
          `Práctica ${count}`,
          deposit.currency,
        );
        await appendInitialDeposit(
          db,
          asPortfolioId(fresh.id),
          deposit,
          executedAt,
        );
        return { archived, active: await mapInitialized(db, fresh) };
      });
    },

    async voidBuy(ownerId, transactionId, executedAt) {
      return database.transaction(async (tx) => {
        const db = tx as unknown as Database;
        await tx.insert(users).values({ id: ownerId }).onConflictDoNothing();
        await tx.execute(
          sql`select id from ${users} where id = ${ownerId} for update`,
        );
        const current = await activeRow(db, ownerId);
        if (!current)
          throw new DomainError(
            "PORTFOLIO_NOT_INITIALIZED",
            "El portafolio no ha sido inicializado.",
          );
        await tx.execute(
          sql`select id from ${portfolios} where id = ${current.id} for update`,
        );
        const target = (
          await tx
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.id, transactionId),
                eq(transactions.portfolioId, current.id),
              ),
            )
            .limit(1)
        )[0];
        if (!target)
          throw new DomainError("BUY_NOT_FOUND", "La compra no existe.");
        if (target.type !== "BUY")
          throw new DomainError(
            "INVALID_VOID_TARGET",
            "El movimiento no es una compra.",
          );
        const existing = (
          await tx
            .select({ id: transactions.id })
            .from(transactions)
            .where(
              and(
                eq(transactions.type, "VOID_BUY"),
                eq(transactions.reversalOfTransactionId, transactionId),
              ),
            )
            .limit(1)
        )[0];
        if (existing)
          throw new DomainError(
            "BUY_ALREADY_VOIDED",
            "La compra ya fue revertida.",
          );
        await tx.insert(transactions).values({
          id: randomUUID(),
          portfolioId: current.id,
          type: "VOID_BUY",
          grossAmount: "0.00",
          fees: "0.00",
          currency: current.baseCurrency,
          executedAt,
          source: "USER_SIMULATION",
          createdAt: executedAt,
          reversalOfTransactionId: transactionId,
        });
        const fresh = await activeRow(db, ownerId);
        if (!fresh)
          throw new PersistenceError(
            "DATABASE_UNAVAILABLE",
            "No se leyó el escenario activo.",
          );
        return mapInitialized(db, fresh);
      });
    },
  };
}
