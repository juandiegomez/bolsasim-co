import { createPortfolioHandlers } from "@/infrastructure/http/portfolio-handlers";
import { createDefaultPortfolioRouteDependencies } from "@/infrastructure/portfolio/portfolio-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handlers() {
  const dependencies = createDefaultPortfolioRouteDependencies();
  return createPortfolioHandlers(
    {
      initialize: dependencies.initialize,
      snapshot: dependencies.snapshot,
    },
    dependencies.logger,
  );
}

export function POST(request: Request) {
  return handlers().initialize(request);
}

const notAllowed = (request: Request) =>
  handlers().methodNotAllowed("POST")(request);

export {
  notAllowed as GET,
  notAllowed as PUT,
  notAllowed as PATCH,
  notAllowed as DELETE,
};
