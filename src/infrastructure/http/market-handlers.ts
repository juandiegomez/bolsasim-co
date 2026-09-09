import { z } from "zod";
import {
  createGetHistoricalSeries,
  createGetInstrumentDetail,
  createGetLatestPrice,
  createListInstruments,
} from "@/application/use-cases/market-queries";
import type { StructuredLogger } from "@/application/ports/logger";
import type { InstrumentId } from "@/domain/ids";
import { DomainError } from "@/domain/errors";
import {
  serializeHistoricalSeries,
  serializeInstrumentPage,
  serializePriceObservation,
} from "./serialize-market";
import { domainProblemResponse } from "./domain-problem";
import { handleRequest } from "./handle-request";
import { problemResponse } from "./problem";

const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const statusSchema = z.enum(["ACTIVE", "INACTIVE", "UNAVAILABLE"]).optional();
const priceBasisSchema = z
  .enum(["UNADJUSTED_CLOSE", "ADJUSTED_CLOSE"])
  .default("UNADJUSTED_CLOSE");
const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function queryParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  return value === null || value === "" ? undefined : value;
}

function parseLimit(url: URL): number {
  const raw = queryParam(url, "limit");
  if (!raw) return 20;
  const parsed = limitSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError("INVALID_QUERY", "El parámetro limit es inválido.");
  }
  return parsed.data;
}

function parseStatus(url: URL) {
  const raw = queryParam(url, "status");
  if (!raw) return undefined;
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError("INVALID_QUERY", "El parámetro status es inválido.");
  }
  return parsed.data;
}

function parsePriceBasis(url: URL) {
  const raw = queryParam(url, "priceBasis") ?? "UNADJUSTED_CLOSE";
  const parsed = priceBasisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError(
      "UNSUPPORTED_PRICE_BASIS",
      "La base de precio solicitada no es soportada.",
    );
  }
  return parsed.data;
}

function parseInstrumentId(value: string): InstrumentId {
  if (!uuidPattern.test(value)) {
    throw new DomainError("INVALID_QUERY", "El instrumentId es inválido.");
  }
  return value as InstrumentId;
}

export interface MarketRouteUseCases {
  readonly list: ReturnType<typeof createListInstruments>;
  readonly detail: ReturnType<typeof createGetInstrumentDetail>;
  readonly latestPrice: ReturnType<typeof createGetLatestPrice>;
  readonly series: ReturnType<typeof createGetHistoricalSeries>;
}

export function createMarketHandlers(
  useCases: MarketRouteUseCases,
  logger: StructuredLogger,
) {
  function operation(
    requestId: string,
    run: () => Promise<Response>,
  ): Promise<Response> {
    return run().catch((error) => domainProblemResponse(error, requestId));
  }

  return {
    list: (request: Request): Promise<Response> =>
      handleRequest(
        request,
        (requestId) =>
          operation(requestId, async () => {
            const url = new URL(request.url);
            const page = await useCases.list.execute({
              query: queryParam(url, "query"),
              status: parseStatus(url),
              cursor: queryParam(url, "cursor"),
              limit: parseLimit(url),
            });
            return Response.json(serializeInstrumentPage(page));
          }),
        logger,
      ),
    detail: (
      request: Request,
      context: { params: Promise<{ instrumentId: string }> },
    ): Promise<Response> =>
      handleRequest(
        request,
        (requestId) =>
          operation(requestId, async () => {
            const { instrumentId } = await context.params;
            const record = await useCases.detail.execute(
              parseInstrumentId(instrumentId),
            );
            return Response.json(
              serializeInstrumentPage({ items: [record], nextCursor: null })
                .items[0],
            );
          }),
        logger,
      ),
    latestPrice: (
      request: Request,
      context: { params: Promise<{ instrumentId: string }> },
    ): Promise<Response> =>
      handleRequest(
        request,
        (requestId) =>
          operation(requestId, async () => {
            const { instrumentId } = await context.params;
            const basis = parsePriceBasis(new URL(request.url));
            const observation = await useCases.latestPrice.execute(
              parseInstrumentId(instrumentId),
              basis,
            );
            return Response.json(serializePriceObservation(observation));
          }),
        logger,
      ),
    series: (
      request: Request,
      context: { params: Promise<{ instrumentId: string }> },
    ): Promise<Response> =>
      handleRequest(
        request,
        (requestId) =>
          operation(requestId, async () => {
            const { instrumentId } = await context.params;
            const url = new URL(request.url);
            const from = queryParam(url, "from");
            const to = queryParam(url, "to");
            if (!from || !to) {
              throw new DomainError(
                "INVALID_DATE_RANGE",
                "Los parámetros from y to son obligatorios.",
              );
            }
            const series = await useCases.series.execute({
              instrumentId: parseInstrumentId(instrumentId),
              from,
              to,
              basis: parsePriceBasis(url),
            });
            return Response.json(serializeHistoricalSeries(series));
          }),
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
