import { expect, test } from "@playwright/test";

const DEMO1 = "a1b2c3d4-0001-4a01-9a01-000000000001";

test("PED-001/PED-002: reset archives examples and void restores the projection", async ({
  request,
}) => {
  const firstReset = await request.post("/api/v1/scenarios/reset");
  expect(firstReset.status()).toBe(201);

  const stalePreview = await request.post("/api/v1/buy-previews", {
    data: {
      instrumentId: DEMO1,
      amount: { amount: "1000000.00", currency: "COP" },
    },
  });
  expect(stalePreview.status()).toBe(201);
  const stalePreviewId = (await stalePreview.json()).id as string;

  const secondReset = await request.post("/api/v1/scenarios/reset");
  expect(secondReset.status()).toBe(201);
  const resetBody = await secondReset.json();
  expect(resetBody.archivedScenario.status).toBe("ARCHIVED");
  expect(resetBody.archivedScenario.id).not.toBe(resetBody.activeScenario.id);
  expect(resetBody.portfolio.cash).toEqual({
    amount: "10000000.00",
    currency: "COP",
  });

  const staleConfirmation = await request.post(
    `/api/v1/buy-previews/${stalePreviewId}/confirm`,
    { headers: { "Idempotency-Key": "stale-preview" } },
  );
  expect(staleConfirmation.status()).toBe(409);
  expect((await staleConfirmation.json()).code).toBe("SCENARIO_ARCHIVED");

  const preview = await request.post("/api/v1/buy-previews", {
    data: {
      instrumentId: DEMO1,
      amount: { amount: "1000000.00", currency: "COP" },
    },
  });
  const confirmed = await request.post(
    `/api/v1/buy-previews/${(await preview.json()).id}/confirm`,
    { headers: { "Idempotency-Key": "voidable-buy" } },
  );
  expect(confirmed.status()).toBe(201);
  const transactionId = (await confirmed.json()).transaction.id as string;

  const voided = await request.post(
    `/api/v1/portfolio/transactions/${transactionId}/void`,
  );
  expect(voided.status()).toBe(201);
  const voidBody = await voided.json();
  expect(voidBody.voidTransaction.type).toBe("VOID_BUY");
  expect(voidBody.portfolio.cash).toEqual({
    amount: "10000000.00",
    currency: "COP",
  });

  const movements = await request.get(
    "/api/v1/portfolio/transactions?limit=100",
  );
  const types = (await movements.json()).items.map(
    (item: { type: string }) => item.type,
  );
  expect(types).toContain("BUY");
  expect(types).toContain("VOID_BUY");

  const scenarios = await request.get("/api/v1/scenarios");
  expect(scenarios.status()).toBe(200);
  expect(
    (await scenarios.json()).items.filter(
      (item: { status: string }) => item.status === "ACTIVE",
    ),
  ).toHaveLength(1);

  // Leave the shared E2E database with an empty active scenario for the
  // independent trading specs that run after this one.
  expect((await request.post("/api/v1/scenarios/reset")).status()).toBe(201);
});
