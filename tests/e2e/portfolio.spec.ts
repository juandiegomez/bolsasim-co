import { expect, test } from "@playwright/test";

const cash = { amount: "10000000.00", currency: "COP" };

test("PORT-001: HTTP initialization is idempotent across two calls", async ({
  request,
}) => {
  const first = await request.post("/api/v1/portfolios/initialize");
  expect(first.status()).toBe(200);
  const firstSnapshot = await first.json();
  expect(firstSnapshot.cash).toEqual(cash);
  expect(firstSnapshot.valuationStatus).toBe("COMPLETE");

  const second = await request.post("/api/v1/portfolios/initialize");
  expect(second.status()).toBe(200);
  const secondSnapshot = await second.json();
  expect(secondSnapshot.portfolioId).toBe(firstSnapshot.portfolioId);
  expect(secondSnapshot.cash).toEqual(cash);
});

test("PORT-002/UI-001: the dashboard shows the exact balance and conserves it on reload", async ({
  page,
  request,
}) => {
  const initialize = await request.post("/api/v1/portfolios/initialize");
  expect(initialize.status()).toBe(200);

  for (let load = 0; load < 2; load += 1) {
    await page.goto("/");
    await expect(page.getByText("Efectivo disponible")).toBeVisible();
    await expect(page.getByTestId("available-cash")).toHaveText(
      "$ 10.000.000,00 COP",
    );
  }
});

test("PORT-002: GET /portfolio rejects mutations with a documented Problem", async ({
  request,
}) => {
  const mutation = await request.post("/api/v1/portfolio");
  expect(mutation.status()).toBe(405);
  const problem = await mutation.json();
  expect(problem).toMatchObject({
    code: "METHOD_NOT_ALLOWED",
    requestId: mutation.headers()["x-request-id"],
  });
});

test("PORT-004/MDATA-001/UI-001: positions route exposes the same valued projection as the dashboard", async ({
  request,
}) => {
  const reset = await request.post("/api/v1/scenarios/reset");
  expect(reset.status()).toBe(201);

  const empty = await request.get("/api/v1/portfolio/positions", {
    headers: { "X-Request-Id": "e2e-positions-empty" },
  });
  expect(empty.status()).toBe(200);
  expect(empty.headers()["x-request-id"]).toBe("e2e-positions-empty");
  expect(await empty.json()).toEqual({ items: [] });

  const preview = await request.post("/api/v1/buy-previews", {
    data: {
      instrumentId: "a1b2c3d4-0001-4a01-9a01-000000000001",
      amount: { amount: "2000000.00", currency: "COP" },
    },
  });
  expect(preview.status()).toBe(201);
  const previewBody = await preview.json();
  const confirmation = await request.post(
    `/api/v1/buy-previews/${previewBody.id}/confirm`,
    { headers: { "Idempotency-Key": "e2e-positions-buy" } },
  );
  expect(confirmation.status()).toBe(201);
  const confirmationBody = await confirmation.json();

  const valued = await request.get("/api/v1/portfolio/positions");
  expect(valued.status()).toBe(200);
  const valuedBody = await valued.json();
  expect(valuedBody.items).toEqual(confirmationBody.portfolio.positions);
  expect(valuedBody.items[0].valuationStatus).toBe("VALUED");
  expect(valuedBody.items[0].price.metadata.mode).toBe("demo");
});
