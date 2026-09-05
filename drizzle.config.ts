import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { getEnvironment } from "./src/infrastructure/config/env";

// Drizzle Kit loads this file through its CommonJS loader (unlike tsx scripts).
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/database/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: getEnvironment().DATABASE_URL },
});
