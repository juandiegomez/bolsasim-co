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

export function GET(request: Request) {
  return handlers().snapshot(request);
}

const notAllowed = (request: Request) =>
  handlers().methodNotAllowed("GET")(request);

export {
  notAllowed as POST,
  notAllowed as PUT,
  notAllowed as PATCH,
  notAllowed as DELETE,
};
