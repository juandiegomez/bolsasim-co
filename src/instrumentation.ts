export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnvironment, ConfigurationError } =
      await import("./infrastructure/config/env");
    const { createLogger } = await import("./infrastructure/logging/logger");
    try {
      const environment = getEnvironment();
      createLogger(environment.LOG_LEVEL).log({
        level: "info",
        event: "application.started",
      });
    } catch (error) {
      createLogger().log({
        level: "error",
        event: "application.configuration_invalid",
        category: "configuration",
        errorCode: "CONFIGURATION_INVALID",
      });
      throw error instanceof ConfigurationError
        ? error
        : new ConfigurationError(["environment"]);
    }
  }
}
