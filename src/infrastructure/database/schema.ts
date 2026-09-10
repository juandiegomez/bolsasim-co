import { sql } from "drizzle-orm";
import {
  bigserial,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ADR-0003: append-only authoritative ledger with unique indexes protecting
// the initial deposit; users and portfolios are the local identity roots.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    baseCurrency: text("base_currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("portfolios_owner_id_unique").on(table.ownerId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id),
    type: text("type").notNull(),
    instrumentId: uuid("instrument_id"),
    quantity: numeric("quantity", { precision: 28, scale: 8 }),
    unitPrice: numeric("unit_price", { precision: 28, scale: 8 }),
    grossAmount: numeric("gross_amount", { precision: 24, scale: 2 }).notNull(),
    fees: numeric("fees", { precision: 24, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    marketSessionDate: date("market_session_date", { mode: "string" }),
    marketData: jsonb("market_data"),
    source: text("source").notNull(),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    ledgerSequence: bigserial("ledger_sequence", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("transactions_initial_deposit_unique")
      .on(table.portfolioId)
      .where(sql`type = 'INITIAL_DEPOSIT'`),
    uniqueIndex("transactions_idempotency_key_unique")
      .on(table.idempotencyKey)
      .where(sql`idempotency_key is not null`),
    index("transactions_ledger_order_idx").on(
      table.portfolioId,
      table.executedAt,
      table.createdAt,
      table.id,
    ),
  ],
);

// PORT-003: server-calculated previews are durable, owner-scoped and consumed
// atomically with the ledger entry. No value supplied by the client is stored.
export const buyPreviews = pgTable(
  "buy_previews",
  {
    id: uuid("id").primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id),
    instrumentId: uuid("instrument_id").notNull(),
    requestedAmount: numeric("requested_amount", {
      precision: 24,
      scale: 2,
    }).notNull(),
    currency: text("currency").notNull(),
    unitPrice: numeric("unit_price", { precision: 28, scale: 8 }).notNull(),
    quantity: numeric("quantity", { precision: 28, scale: 8 }).notNull(),
    grossAmount: numeric("gross_amount", { precision: 24, scale: 2 }).notNull(),
    fees: numeric("fees", { precision: 24, scale: 2 }).notNull(),
    totalDebit: numeric("total_debit", { precision: 24, scale: 2 }).notNull(),
    availableCash: numeric("available_cash", {
      precision: 24,
      scale: 2,
    }).notNull(),
    marketSessionDate: date("market_session_date", {
      mode: "string",
    }).notNull(),
    marketData: jsonb("market_data").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    transactionId: uuid("transaction_id"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("buy_previews_idempotency_key_unique")
      .on(table.idempotencyKey)
      .where(sql`idempotency_key is not null`),
    index("buy_previews_portfolio_idx").on(table.portfolioId, table.expiresAt),
  ],
);
