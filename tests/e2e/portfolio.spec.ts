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
      "$ 10.000.000,00",
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
