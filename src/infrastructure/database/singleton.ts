import { getEnvironment } from "@/infrastructure/config/env";
import { createDatabase } from "./client";

let instance: ReturnType<typeof createDatabase> | undefined;

// Lazily created once per server process; the pool only connects on first use.
export function getApplicationDatabase() {
  instance ??= createDatabase(getEnvironment().DATABASE_URL);
  return instance;
}
