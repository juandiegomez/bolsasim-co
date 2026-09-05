import type { NextConfig } from "next";
import { getEnvironment } from "./src/infrastructure/config/env";

// Next can keep its process alive after an instrumentation rejection.
// Validate during config loading as well, before accepting an invalid startup.
getEnvironment();

const config: NextConfig = {
  poweredByHeader: false,
};

export default config;
