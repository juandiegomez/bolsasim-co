import { createPortfolioHandlers } from "@/infrastructure/http/portfolio-handlers";
import { createDefaultPortfolioRouteDependencies } from "@/infrastructure/portfolio/portfolio-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlers() {
  const dependencies = await createDefaultPortfolioRouteDependencies();
  return createPortfolioHandlers(
    {
      initialize: dependencies.initialize,
      snapshot: dependencies.snapshot,
    },
    dependencies.logger,
  );
}

export async function POST(request: Request) {
  return (await handlers()).initialize(request);
}

const notAllowed = async (request: Request) =>
  (await handlers()).methodNotAllowed("POST")(request);

export {
  notAllowed as GET,
  notAllowed as PUT,
  notAllowed as PATCH,
  notAllowed as DELETE,
};
