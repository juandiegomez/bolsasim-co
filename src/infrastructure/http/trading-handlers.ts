import { z } from "zod";
import type { StructuredLogger } from "@/application/ports/logger";
import type { createCreateBuyPreview } from "@/application/use-cases/create-buy-preview";
import type { createConfirmBuyPreview } from "@/application/use-cases/confirm-buy-preview";
import { DomainError } from "@/domain/errors";
import { asInstrumentId, asPreviewId } from "@/domain/ids";
import type { PortfolioSnapshot } from "@/domain/portfolio";
import { Money } from "@/domain/money";
import { domainProblemResponse } from "./domain-problem";
import { handleRequest } from "./handle-request";
import { serializeBuyPreview, serializeTransaction } from "./serialize-trading";
import { serializePortfolioSnapshot } from "./serialize-portfolio";

const requestSchema = z
  .object({
    instrumentId: z.uuid(),
    amount: z
      .object({
        amount: z.string(),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .strict(),
  })
  .strict();

export function createTradingHandlers(
  useCases: {
    readonly preview: ReturnType<typeof createCreateBuyPreview>;
    readonly confirm: ReturnType<typeof createConfirmBuyPreview>;
    readonly snapshot: { execute(): Promise<PortfolioSnapshot> };
  },
  logger: StructuredLogger,
) {
  return {
    preview: (request: Request) =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            const input = requestSchema.safeParse(await request.json());
            if (!input.success) {
              throw new DomainError(
                "INVALID_QUERY",
                "El cuerpo de compra es inválido.",
              );
            }
            const preview = await useCases.preview.execute({
              instrumentId: asInstrumentId(input.data.instrumentId),
              amount: Money.create(
                input.data.amount.amount,
                input.data.amount.currency,
              ),
            });
            return Response.json(serializeBuyPreview(preview), { status: 201 });
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
    confirm: (request: Request, previewId: string) =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            const idempotencyKey = request.headers.get("idempotency-key");
            if (!idempotencyKey || idempotencyKey.length > 128) {
              throw new DomainError(
                "INVALID_QUERY",
                "Idempotency-Key es obligatoria.",
              );
            }
            const result = await useCases.confirm.execute({
              previewId: asPreviewId(previewId),
              idempotencyKey,
            });
            return Response.json(
              {
                transaction: serializeTransaction(result.transaction),
                portfolio: serializePortfolioSnapshot(
                  await useCases.snapshot.execute(),
                ),
              },
              { status: result.replayed ? 200 : 201 },
            );
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
  };
}
