DROP INDEX "portfolios_owner_id_unique";
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "status" text DEFAULT 'ACTIVE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "label" text DEFAULT 'Práctica' NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reversal_of_transaction_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "portfolios_owner_active_unique" ON "portfolios" USING btree ("owner_id") WHERE status = 'ACTIVE';
--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_void_target_unique" ON "transactions" USING btree ("reversal_of_transaction_id") WHERE type = 'VOID_BUY';
