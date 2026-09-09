import type { StructuredLogger } from "@/application/ports/logger";
import type { PortfolioSnapshot } from "@/domain/portfolio";
import { domainProblemResponse } from "./domain-problem";
import { handleRequest } from "./handle-request";
import { problemResponse } from "./problem";
import { serializePortfolioSnapshot } from "./serialize-portfolio";

export interface PortfolioRouteUseCases {
  readonly initialize: { execute(): Promise<PortfolioSnapshot> };
  readonly snapshot: { execute(): Promise<PortfolioSnapshot> };
}

function snapshotResponse(snapshot: PortfolioSnapshot): Response {
  return Response.json(serializePortfolioSnapshot(snapshot));
}

export function createPortfolioHandlers(
  useCases: PortfolioRouteUseCases,
  logger: StructuredLogger,
) {
  return {
    initialize: (request: Request) =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            return snapshotResponse(await useCases.initialize.execute());
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
    snapshot: (request: Request) =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            return snapshotResponse(await useCases.snapshot.execute());
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
