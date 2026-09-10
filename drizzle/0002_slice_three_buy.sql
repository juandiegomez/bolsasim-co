ALTER TABLE "transactions" ALTER COLUMN "quantity" TYPE numeric(28, 8);
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "unit_price" TYPE numeric(28, 8);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "market_data" jsonb;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "ledger_sequence" bigserial NOT NULL;
--> statement-breakpoint
CREATE TABLE "buy_previews" (
  "id" uuid PRIMARY KEY NOT NULL,
  "portfolio_id" uuid NOT NULL REFERENCES "portfolios"("id"),
  "instrument_id" uuid NOT NULL,
  "requested_amount" numeric(24, 2) NOT NULL,
  "currency" text NOT NULL,
  "unit_price" numeric(28, 8) NOT NULL,
  "quantity" numeric(28, 8) NOT NULL,
  "gross_amount" numeric(24, 2) NOT NULL,
  "fees" numeric(24, 2) NOT NULL,
  "total_debit" numeric(24, 2) NOT NULL,
  "available_cash" numeric(24, 2) NOT NULL,
  "market_session_date" date NOT NULL,
  "market_data" jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "transaction_id" uuid,
  "idempotency_key" text,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "buy_previews_idempotency_key_unique" ON "buy_previews" USING btree ("idempotency_key") WHERE idempotency_key is not null;
--> statement-breakpoint
CREATE INDEX "buy_previews_portfolio_idx" ON "buy_previews" USING btree ("portfolio_id", "expires_at");
