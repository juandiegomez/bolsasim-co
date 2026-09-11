CREATE SEQUENCE IF NOT EXISTS "transactions_ledger_sequence_seq";
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "ledger_sequence" bigint;
--> statement-breakpoint
ALTER SEQUENCE "transactions_ledger_sequence_seq" OWNED BY "transactions"."ledger_sequence";
--> statement-breakpoint
WITH ordered AS (
  SELECT
    "id",
    COALESCE((SELECT MAX("ledger_sequence") FROM "transactions"), 0)
      + ROW_NUMBER() OVER (
        ORDER BY "portfolio_id", "executed_at", "created_at", "id"
      ) AS "ledger_sequence"
  FROM "transactions"
  WHERE "ledger_sequence" IS NULL
)
UPDATE "transactions" AS current_transaction
SET "ledger_sequence" = ordered."ledger_sequence"
FROM ordered
WHERE current_transaction."id" = ordered."id";
--> statement-breakpoint
ALTER TABLE "transactions"
  ALTER COLUMN "ledger_sequence" SET DEFAULT nextval('transactions_ledger_sequence_seq');
--> statement-breakpoint
SELECT setval(
  'transactions_ledger_sequence_seq',
  COALESCE(MAX("ledger_sequence"), 1),
  MAX("ledger_sequence") IS NOT NULL
)
FROM "transactions";
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "ledger_sequence" SET NOT NULL;
