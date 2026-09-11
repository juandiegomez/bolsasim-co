import { z } from "zod";
import type { StructuredLogger } from "@/application/ports/logger";
import type { PortfolioSnapshot } from "@/domain/portfolio";
import type {
  createListScenarios,
  createResetScenario,
  createVoidBuy,
} from "@/application/use-cases/manage-scenarios";
import { asTransactionId } from "@/domain/ids";
import { DomainError } from "@/domain/errors";
import { domainProblemResponse } from "./domain-problem";
import { handleRequest } from "./handle-request";
import { problemResponse } from "./problem";
import { serializePortfolioSnapshot } from "./serialize-portfolio";
import { serializeTransaction } from "./serialize-trading";

type ScenarioUseCases = {
  readonly list: ReturnType<typeof createListScenarios>;
  readonly reset: ReturnType<typeof createResetScenario>;
  readonly voidBuy: ReturnType<typeof createVoidBuy>;
  readonly snapshot: { execute(): Promise<PortfolioSnapshot> };
};

function serializeScenario(scenario: {
  portfolioId: string;
  label: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  archivedAt: Date | null;
}) {
  return {
    id: scenario.portfolioId,
    portfolioId: scenario.portfolioId,
    label: scenario.label,
    status: scenario.status,
    createdAt: scenario.createdAt.toISOString(),
    archivedAt: scenario.archivedAt?.toISOString() ?? null,
  };
}

export function createScenarioHandlers(
  useCases: ScenarioUseCases,
  logger: StructuredLogger,
) {
  return {
    list: (request: Request) =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            const items = await useCases.list.execute();
            return Response.json({ items: items.map(serializeScenario) });
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
    reset: (request: Request) =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            const result = await useCases.reset.execute();
            return Response.json(
              {
                archivedScenario: result.archived
                  ? serializeScenario(result.archived)
                  : null,
                activeScenario: serializeScenario(result.active),
                portfolio: serializePortfolioSnapshot(
                  await useCases.snapshot.execute(),
                ),
              },
              { status: 201 },
            );
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
    voidBuy: (request: Request, transactionId: string) =>
      handleRequest(
        request,
        async (requestId) => {
          try {
            if (!z.uuid().safeParse(transactionId).success) {
              throw new DomainError(
                "INVALID_QUERY",
                "El identificador de compra es inválido.",
              );
            }
            const result = await useCases.voidBuy.execute(
              asTransactionId(transactionId),
            );
            const voidTransaction = result.ledger.find(
              (entry) =>
                entry.type === "VOID_BUY" &&
                entry.reversalOfTransactionId === transactionId,
            );
            if (!voidTransaction)
              throw new DomainError(
                "CORRUPT_LEDGER",
                "No se leyó la reversión registrada.",
              );
            return Response.json(
              {
                voidTransaction: serializeTransaction(voidTransaction),
                portfolio: serializePortfolioSnapshot(
                  await useCases.snapshot.execute(),
                ),
              },
              { status: 201 },
            );
          } catch (error) {
            return domainProblemResponse(error, requestId);
          }
        },
        logger,
      ),
    methodNotAllowed: (allow: string) => (request: Request) =>
      handleRequest(
        request,
        (requestId) =>
          Promise.resolve(
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
          ),
        logger,
      ),
  };
}
