import { createScenarioHandlers } from "@/infrastructure/http/scenario-handlers";
import { createDefaultPortfolioRouteDependencies } from "@/infrastructure/portfolio/portfolio-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlers() {
  const dependencies = await createDefaultPortfolioRouteDependencies();
  return createScenarioHandlers(
    {
      list: dependencies.scenarios,
      reset: dependencies.reset,
      voidBuy: dependencies.voidBuy,
      snapshot: dependencies.snapshot,
    },
    dependencies.logger,
  );
}

export async function GET(request: Request) {
  return (await handlers()).list(request);
}

const notAllowed = async (request: Request) =>
  (await handlers()).methodNotAllowed("GET")(request);
export {
  notAllowed as POST,
  notAllowed as PUT,
  notAllowed as PATCH,
  notAllowed as DELETE,
};
