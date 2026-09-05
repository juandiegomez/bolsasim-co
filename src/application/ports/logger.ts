export type LogLevel = "debug" | "info" | "warn" | "error";
export type ErrorCategory = "configuration" | "persistence" | "unexpected";

export interface LogEvent {
  level: LogLevel;
  event: string;
  requestId?: string;
  errorCode?: string;
  category?: ErrorCategory;
  durationMs?: number;
  status?: number;
}

export interface StructuredLogger {
  log(event: LogEvent): void;
}
