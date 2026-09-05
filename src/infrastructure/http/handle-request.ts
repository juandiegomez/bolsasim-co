import type { StructuredLogger } from "@/application/ports/logger";
import { resolveRequestId } from "./request-id";

export async function handleRequest(
  request: Request,
  operation: (requestId: string) => Response | Promise<Response>,
  logger: StructuredLogger,
): Promise<Response> {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const start = performance.now();
  try {
    const response = await operation(requestId);
    response.headers.set("X-Request-Id", requestId);
    response.headers.set("Cache-Control", "no-store");
    logger.log({
      level: "info",
      event: "http.completed",
      requestId,
      durationMs: Math.round(performance.now() - start),
      status: response.status,
    });
    return response;
  } catch {
    logger.log({
      level: "error",
      event: "http.failed",
      requestId,
      errorCode: "INTERNAL_ERROR",
      category: "unexpected",
      status: 500,
      durationMs: Math.round(performance.now() - start),
    });
    return Response.json(
      {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        code: "INTERNAL_ERROR",
        message: "No fue posible completar la solicitud.",
        requestId,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/problem+json",
          "X-Request-Id": requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
