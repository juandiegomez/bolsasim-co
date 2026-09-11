import { z } from "zod";
import type { StructuredLogger } from "@/application/ports/logger";
import type { createRunHistoricalSimulation } from "@/application/use-cases/run-historical-simulation";
import { asInstrumentId } from "@/domain/ids";
import { DomainError } from "@/domain/errors";
import { Money } from "@/domain/money";
import { domainProblemResponse } from "./domain-problem";
import { handleRequest } from "./handle-request";
import { problemResponse } from "./problem";
import { serializeHistoricalSimulation } from "./serialize-historical-simulation";

const requestSchema = z
  .object({
    instrumentId: z.uuid(),
    amount: z
      .object({
        amount: z.string(),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .strict(),
    requestedStartDate: z.string(),
    requestedEndDate: z.string().nullable().optional(),
    priceBasis: z
      .enum(["UNADJUSTED_CLOSE", "ADJUSTED_CLOSE"])
      .default("UNADJUSTED_CLOSE"),
  })
  .strict();

export function createHistoricalSimulationHandlers(
  useCases: {
    readonly run: ReturnType<typeof createRunHistoricalSimulation>;
  },
  logger: StructuredLogger,
) {
  return {
    run: (request: Request): Promise<Response> =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            const input = requestSchema.safeParse(await request.json());
            if (!input.success) {
              throw new DomainError(
                "INVALID_QUERY",
                "El cuerpo de la simulación histórica es inválido.",
              );
            }
            const result = await useCases.run.execute({
              instrumentId: asInstrumentId(input.data.instrumentId),
              amount: Money.create(
                input.data.amount.amount,
                input.data.amount.currency,
              ),
              requestedStartDate: input.data.requestedStartDate,
              requestedEndDate: input.data.requestedEndDate ?? null,
              priceBasis: input.data.priceBasis,
            });
            return Response.json(serializeHistoricalSimulation(result));
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
    methodNotAllowed:
      (allow: string) =>
      (request: Request): Promise<Response> =>
        handleRequest(
          request,
          (requestId) =>
            problemResponse(
              {
                title: "Method Not Allowed",
                status: 405,
                code: "METHOD_NOT_ALLOWED",
                message: "Método no permitido para esta ruta.",
                requestId,
              },
              { Allow: allow },
            ),
          logger,
        ),
  };
}
