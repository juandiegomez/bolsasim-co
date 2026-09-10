import type { StructuredLogger } from "@/application/ports/logger";
import type { createGetPortfolioEvolution } from "@/application/use-cases/get-portfolio-evolution";
import type { createListPortfolioTransactions } from "@/application/use-cases/list-portfolio-transactions";
import { DomainError } from "@/domain/errors";
import { problemResponse } from "./problem";
import { domainProblemResponse } from "./domain-problem";
import { handleRequest } from "./handle-request";
import { serializeTransaction } from "./serialize-trading";

type EvolutionUseCase = ReturnType<typeof createGetPortfolioEvolution>;
type TransactionsUseCase = ReturnType<typeof createListPortfolioTransactions>;

function serializeEvolutionPoint(point: {
  date: string;
  cash: { toString(): string; currency: string };
  totalValue: { toString(): string; currency: string } | null;
  valuationStatus: "COMPLETE" | "INCOMPLETE";
  priceSessionDates: Readonly<Record<string, string>>;
}) {
  return {
    date: point.date,
    cash: {
      amount: point.cash.toString(),
      currency: point.cash.currency,
    },
    totalValue: point.totalValue
      ? {
          amount: point.totalValue.toString(),
          currency: point.totalValue.currency,
        }
      : null,
    valuationStatus: point.valuationStatus,
    priceSessionDates: { ...point.priceSessionDates },
  };
}

// PORT-005/PORT-002: derived read endpoints with the same Problem semantics
// as the rest of the API; kept injectable for contract tests.
export function createPortfolioQueryHandlers(
  useCases: {
    readonly evolution: EvolutionUseCase;
    readonly transactions: TransactionsUseCase;
  },
  logger: StructuredLogger,
) {
  return {
    evolution: (request: Request): Promise<Response> =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            const url = new URL(request.url);
            const from = url.searchParams.get("from");
            const to = url.searchParams.get("to");
            if (!from || !to) {
              throw new DomainError(
                "INVALID_DATE_RANGE",
                "Los parámetros from y to son obligatorios.",
              );
            }
            const items = await useCases.evolution.execute({ from, to });
            return Response.json({ items: items.map(serializeEvolutionPoint) });
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
    transactions: (request: Request): Promise<Response> =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            const url = new URL(request.url);
            const rawLimit = url.searchParams.get("limit") ?? "20";
            const limit = Number(rawLimit);
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
              throw new DomainError("INVALID_QUERY", "El límite es inválido.");
            }
            const page = await useCases.transactions.execute({
              cursor: url.searchParams.get("cursor") ?? undefined,
              limit,
            });
            return Response.json({
              items: page.items.map(serializeTransaction),
              nextCursor: page.nextCursor,
            });
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
    methodNotAllowed:
      (allow: string) =>
      (request: Request, _context?: unknown): Promise<Response> =>
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
