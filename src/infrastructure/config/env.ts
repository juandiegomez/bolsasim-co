import { z } from "zod";

const databaseUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.length > 0 &&
      url.pathname.length > 1 &&
      !url.hash
    );
  } catch {
    return false;
  }
});

const decimalAmount = z
  .string()
  .regex(
    /^(0|[1-9][0-9]*)(\.[0-9]{1,2})$/,
    "Expected an exact decimal amount with at most 2 decimals",
  )
  .refine((value) => value !== "0.00", "Expected a positive amount");

const schema = z.object({
  DATABASE_URL: databaseUrl,
  APP_TIME_ZONE: z.literal("America/Bogota").default("America/Bogota"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DEMO_USER_ID: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      "Expected a UUID",
    )
    .default("00000000-0000-0000-0000-000000000001"),
  INITIAL_DEPOSIT_COP: decimalAmount.default("10000000.00"),
});

export class ConfigurationError extends Error {
  readonly code = "CONFIGURATION_INVALID";
  constructor(readonly fields: readonly string[]) {
    super(`CONFIGURATION_INVALID: ${fields.join(", ")}`);
    this.name = "ConfigurationError";
  }
}

export type Environment = z.infer<typeof schema>;

export function parseEnvironment(
  input: Record<string, string | undefined>,
): Environment {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ConfigurationError([
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }
  return parsed.data;
}

export function getEnvironment(): Environment {
  return parseEnvironment(process.env);
}

export function getTestDatabaseUrl(
  input: Record<string, string | undefined>,
): string {
  const parsed = databaseUrl.safeParse(input.TEST_DATABASE_URL);
  if (!parsed.success || !new URL(parsed.data).pathname.endsWith("_test")) {
    throw new ConfigurationError([
      "TEST_DATABASE_URL (dedicated *_test database required)",
    ]);
  }
  if (input.DATABASE_URL && parsed.data === input.DATABASE_URL) {
    throw new ConfigurationError([
      "TEST_DATABASE_URL must differ from DATABASE_URL",
    ]);
  }
  return parsed.data;
}
