import { createHistoricalSimulationHandlers } from "@/infrastructure/http/historical-simulation-handlers";
import { createDefaultMarketRouteDependencies } from "@/infrastructure/market/market-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlers() {
  const dependencies = await createDefaultMarketRouteDependencies();
  return createHistoricalSimulationHandlers(
    { run: dependencies.useCases.historicalSimulation },
    dependencies.logger,
  );
}

export async function POST(request: Request) {
  return (await handlers()).run(request);
}

export async function GET(request: Request) {
  return (await handlers()).methodNotAllowed("POST")(request);
}

export async function PUT(request: Request) {
  return (await handlers()).methodNotAllowed("POST")(request);
}

export async function PATCH(request: Request) {
  return (await handlers()).methodNotAllowed("POST")(request);
}

export async function DELETE(request: Request) {
  return (await handlers()).methodNotAllowed("POST")(request);
}
