import { createTradingHandlers } from "@/infrastructure/http/trading-handlers";
import { createDefaultTradingRouteDependencies } from "@/infrastructure/trading/trading-dependencies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ previewId: string }> },
) {
  const dependencies = await createDefaultTradingRouteDependencies();
  const { previewId } = await context.params;
  return createTradingHandlers(
    dependencies.useCases,
    dependencies.logger,
  ).confirm(request, previewId);
}
