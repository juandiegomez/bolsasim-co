import { createMarketHandlers } from "@/infrastructure/http/market-handlers";
import { createDefaultMarketRouteDependencies } from "@/infrastructure/market/market-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlers() {
  const dependencies = await createDefaultMarketRouteDependencies();
  return createMarketHandlers(dependencies.useCases, dependencies.logger);
}

export async function GET(request: Request) {
  return (await handlers()).list(request);
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
