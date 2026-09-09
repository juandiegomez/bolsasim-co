CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"base_currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"type" text NOT NULL,
	"instrument_id" uuid,
	"quantity" numeric(24, 8),
	"unit_price" numeric(24, 8),
	"gross_amount" numeric(24, 2) NOT NULL,
	"fees" numeric(24, 2) NOT NULL,
	"currency" text NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"market_session_date" date,
	"source" text NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portfolios_owner_id_unique" ON "portfolios" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_initial_deposit_unique" ON "transactions" USING btree ("portfolio_id") WHERE type = 'INITIAL_DEPOSIT';--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_idempotency_key_unique" ON "transactions" USING btree ("idempotency_key") WHERE idempotency_key is not null;--> statement-breakpoint
CREATE INDEX "transactions_ledger_order_idx" ON "transactions" USING btree ("portfolio_id","executed_at","created_at","id");