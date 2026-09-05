import type { LogLevel, StructuredLogger } from "@/application/ports/logger";

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(
  minimum: LogLevel = "info",
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  now: () => Date = () => new Date(),
): StructuredLogger {
  return {
    log(entry) {
      if (priorities[entry.level] < priorities[minimum]) return;
      // Explicit allowlist: never serialize Error objects, environment or payloads.
      write(
        JSON.stringify({
          timestamp: now().toISOString(),
          level: entry.level,
          event: entry.event,
          requestId: entry.requestId,
          errorCode: entry.errorCode,
          category: entry.category,
          durationMs: entry.durationMs,
          status: entry.status,
        }),
      );
    },
  };
}
