import { createTradingHandlers } from "@/infrastructure/http/trading-handlers";
import { createDefaultTradingRouteDependencies } from "@/infrastructure/trading/trading-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const dependencies = await createDefaultTradingRouteDependencies();
  return createTradingHandlers(
    dependencies.useCases,
    dependencies.logger,
  ).preview(request);
}
