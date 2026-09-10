import { createPortfolioQueryHandlers } from "@/infrastructure/http/portfolio-queries-handlers";
import { createDefaultPortfolioRouteDependencies } from "@/infrastructure/portfolio/portfolio-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlers() {
  const dependencies = await createDefaultPortfolioRouteDependencies();
  return createPortfolioQueryHandlers(
    {
      evolution: dependencies.evolution,
      transactions: dependencies.transactions,
    },
    dependencies.logger,
  );
}

export async function GET(request: Request) {
  return (await handlers()).evolution(request);
}

export async function POST(request: Request) {
  return (await handlers()).methodNotAllowed("GET")(request);
}

export async function PUT(request: Request) {
  return (await handlers()).methodNotAllowed("GET")(request);
}

export async function PATCH(request: Request) {
  return (await handlers()).methodNotAllowed("GET")(request);
}

export async function DELETE(request: Request) {
  return (await handlers()).methodNotAllowed("GET")(request);
}
