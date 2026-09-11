import type { createGetPortfolioSnapshot } from "@/application/use-cases/get-portfolio-snapshot";
import type { StructuredLogger } from "@/application/ports/logger";
import { domainProblemResponse } from "./domain-problem";
import { handleRequest } from "./handle-request";
import { problemResponse } from "./problem";
import { serializePosition } from "./serialize-portfolio";

type SnapshotUseCase = ReturnType<typeof createGetPortfolioSnapshot>;

// PORT-004/PORT-005: this endpoint is a thin read surface over the same
// authoritative snapshot used by the dashboard. It intentionally does not
// project or value positions a second time.
export function createPortfolioPositionsHandlers(
  snapshot: SnapshotUseCase,
  logger: StructuredLogger,
) {
  return {
    positions: (request: Request): Promise<Response> =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            const portfolio = await snapshot.execute();
            return Response.json({
              items: portfolio.positions.map(serializePosition),
            });
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
