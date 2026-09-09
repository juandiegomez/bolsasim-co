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
  INVALID_SCALE: {
    status: 400,
    title: "Bad Request",
    message: "La escala enviada no es válida; no se redondea silenciosamente.",
  },
  CURRENCY_MISMATCH: {
    status: 400,
    title: "Bad Request",
    message: "La moneda enviada no es soportada en el MVP.",
  },
  PORTFOLIO_NOT_INITIALIZED: {
    status: 404,
    title: "Not Found",
    message: "El portafolio aún no ha sido inicializado.",
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
