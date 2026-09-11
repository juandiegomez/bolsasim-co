import { DomainError } from "@/domain/errors";
import { PersistenceError } from "@/infrastructure/database/errors";
import { problemResponse } from "./problem";

const STATUS_BY_DOMAIN_CODE: Record<
  DomainError["code"],
  { status: number; title: string; message: string }
> = {
  INVALID_MONEY: {
    status: 400,
    title: "Bad Request",
    message: "El monto enviado no es válido.",
  },
  INVALID_UNIT_PRICE: {
    status: 400,
    title: "Bad Request",
    message: "El precio enviado no es válido.",
  },
  PURCHASE_AMOUNT_TOO_SMALL: {
    status: 422,
    title: "Unprocessable Entity",
    message: "El monto no alcanza para una compra liquidable.",
  },
  HISTORICAL_AMOUNT_TOO_SMALL: {
    status: 422,
    title: "Unprocessable Entity",
    message: "El monto no alcanza para una inversión histórica liquidable.",
  },
  INSTRUMENT_NOT_TRADABLE: {
    status: 422,
    title: "Unprocessable Entity",
    message: "El instrumento no es operable en el MVP.",
  },
  INSUFFICIENT_FUNDS: {
    status: 409,
    title: "Conflict",
    message: "El efectivo disponible es insuficiente.",
  },
  PREVIEW_NOT_FOUND: {
    status: 404,
    title: "Not Found",
    message: "La previsualización no existe.",
  },
  PREVIEW_EXPIRED: {
    status: 410,
    title: "Gone",
    message: "La previsualización venció; crea una nueva.",
  },
  PREVIEW_ALREADY_USED: {
    status: 409,
    title: "Conflict",
    message: "La previsualización ya fue confirmada.",
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    title: "Conflict",
    message: "La clave de idempotencia pertenece a otra operación.",
  },
  INVALID_SCALE: {
    status: 400,
    title: "Bad Request",
    message: "La escala enviada no es válida; no se redondea silenciosamente.",
  },
  INVALID_QUERY: {
    status: 400,
    title: "Bad Request",
    message: "Los parámetros de la solicitud son inválidos.",
  },
  INVALID_DATE_RANGE: {
    status: 400,
    title: "Bad Request",
    message: "El rango de fechas enviado es inválido.",
  },
  CURRENCY_MISMATCH: {
    status: 400,
    title: "Bad Request",
    message: "La moneda enviada no es soportada en el MVP.",
  },
  UNSUPPORTED_PRICE_BASIS: {
    status: 400,
    title: "Bad Request",
    message: "La base de precio solicitada no es soportada.",
  },
  PORTFOLIO_NOT_INITIALIZED: {
    status: 404,
    title: "Not Found",
    message: "El portafolio aún no ha sido inicializado.",
  },
  INSTRUMENT_NOT_FOUND: {
    status: 404,
    title: "Not Found",
    message: "El instrumento solicitado no existe.",
  },
  NO_MARKET_DATA: {
    status: 404,
    title: "Not Found",
    message: "No existen datos de mercado para la solicitud.",
  },
  NO_MARKET_SESSION: {
    status: 404,
    title: "Not Found",
    message: "Ninguna sesión de mercado satisface la resolución solicitada.",
  },
  COVERAGE_INSUFFICIENT: {
    status: 422,
    title: "Unprocessable Entity",
    message: "El dataset no cubre el rango o la fecha solicitada.",
  },
  INVALID_PROVIDER_DATA: {
    status: 502,
    title: "Bad Gateway",
    message: "Los datos del proveedor de mercado son inconsistentes.",
  },
  PROVIDER_UNAVAILABLE: {
    status: 503,
    title: "Service Unavailable",
    message: "El proveedor de mercado no está disponible; intenta más tarde.",
  },
  RATE_LIMITED: {
    status: 429,
    title: "Too Many Requests",
    message: "El proveedor de mercado limitó las consultas; intenta más tarde.",
  },
  CORRUPT_LEDGER: {
    status: 500,
    title: "Internal Server Error",
    message: "El ledger del portafolio es inconsistente y requiere revisión.",
  },
};

// Architecture § Trust: adapters translate modeled errors without leaking
// internal details; unexpected errors keep bubbling to the generic handler.
export function domainProblemResponse(
  error: unknown,
  requestId: string,
): Response {
  if (error instanceof DomainError) {
    const mapping = STATUS_BY_DOMAIN_CODE[error.code];
    return problemResponse({
      title: mapping.title,
      status: mapping.status,
      code: error.code,
      message: mapping.message,
      requestId,
    });
  }
  if (error instanceof PersistenceError) {
    return problemResponse({
      title: "Service Unavailable",
      status: 503,
      code: error.code,
      message: "La base de datos no está disponible; intenta más tarde.",
      requestId,
    });
  }
  throw error;
}
