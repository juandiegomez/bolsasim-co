import { createMarketHandlers } from "@/infrastructure/http/market-handlers";
import { createDefaultMarketRouteDependencies } from "@/infrastructure/market/market-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ instrumentId: string }> };

async function handlers() {
  const dependencies = await createDefaultMarketRouteDependencies();
  return createMarketHandlers(dependencies.useCases, dependencies.logger);
}

export async function GET(request: Request, context: RouteContext) {
  return (await handlers()).detail(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return (await handlers()).methodNotAllowed("GET")(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return (await handlers()).methodNotAllowed("GET")(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return (await handlers()).methodNotAllowed("GET")(request, context);
}
