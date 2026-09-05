import { getEnvironment } from "@/infrastructure/config/env";
import { handleRequest } from "@/infrastructure/http/handle-request";
import { createLogger } from "@/infrastructure/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleRequest(
    request,
    (requestId) =>
      Response.json({
        status: "ok",
        service: "bolsasim-co",
        requestId,
      }),
    createLogger(getEnvironment().LOG_LEVEL),
  );
}

function methodNotAllowed(request: Request) {
  return handleRequest(
    request,
    (requestId) =>
      Response.json(
        {
          type: "about:blank",
          title: "Method Not Allowed",
          status: 405,
          code: "METHOD_NOT_ALLOWED",
          message: "Utilice GET para consultar liveness.",
          requestId,
        },
        {
          status: 405,
          headers: {
            Allow: "GET, HEAD, OPTIONS",
            "Content-Type": "application/problem+json",
          },
        },
      ),
    createLogger(getEnvironment().LOG_LEVEL),
  );
}

export {
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
};
