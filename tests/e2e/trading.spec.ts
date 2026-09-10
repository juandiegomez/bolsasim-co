import { expect, test } from "@playwright/test";

const DEMO1 = "a1b2c3d4-0001-4a01-9a01-000000000001";

test("PORT-003/FIN-003: preview computes the exact debit with zero fees", async ({
  request,
}) => {
  const initialize = await request.post("/api/v1/portfolios/initialize");
  expect(initialize.status()).toBe(200);
  const preview = await request.post("/api/v1/buy-previews", {
    data: {
      instrumentId: DEMO1,
      amount: { amount: "2000000.00", currency: "COP" },
    },
  });
  expect(preview.status()).toBe(201);
  const body = await preview.json();
  expect(body.quantity).toBe("16666.66666666");
  expect(body.totalDebit).toEqual({ amount: "2000000.00", currency: "COP" });
  expect(body.fees).toEqual({ amount: "0.00", currency: "COP" });
});

test("PORT-003/SEC-001: forged client fields are rejected by the server", async ({
  request,
}) => {
  const forged = await request.post("/api/v1/buy-previews", {
    data: {
      instrumentId: DEMO1,
      amount: { amount: "1000.00", currency: "COP" },
      quantity: "999",
      unitPrice: "1.00",
    },
  });
  expect(forged.status()).toBe(400);
  expect((await forged.json()).code).toBe("INVALID_QUERY");
});

test("PORT-003/UI-001: the buy flow previews, confirms and updates the dashboard", async ({
  page,
  request,
}) => {
  const initialize = await request.post("/api/v1/portfolios/initialize");
  expect(initialize.status()).toBe(200);

  await page.goto(`/instruments/${DEMO1}`);
  await expect(
    page.getByRole("button", { name: "Ver simulación de compra" }),
  ).toBeVisible();
  await page.getByLabel("Monto a invertir (COP)").fill("2000000.00");
  await page.getByRole("button", { name: "Ver simulación de compra" }).click();
  await expect(page.getByText("Preview válida hasta")).toBeVisible();
  await expect(page.getByText("$ 2000000.00 COP")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar compra simulada" }).click();
  await page.waitForURL("http://127.0.0.1:3100/");

  await expect(page.getByText("Efectivo disponible")).toBeVisible();
  await expect(page.getByTestId("available-cash")).toHaveText("$ 8.000.000,00");
  await expect(page.getByText("Posiciones derivadas del ledger")).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("DEMO1");
  await expect(page.getByText("Movimientos recientes")).toBeVisible();
  await expect(page.getByText("Compra simulada")).toBeVisible();
  await expect(page.getByText("Evolución del portafolio")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("available-cash")).toHaveText("$ 8.000.000,00");
});

test("PORT-003/UI-001: insufficient funds surface a controlled error in the panel", async ({
  page,
  request,
}) => {
  const initialize = await request.post("/api/v1/portfolios/initialize");
  expect(initialize.status()).toBe(200);
  await page.goto(`/instruments/${DEMO1}`);
  await page.getByLabel("Monto a invertir (COP)").fill("11000000.00");
  await page.getByRole("button", { name: "Ver simulación de compra" }).click();
  await expect(
    page.getByText(/El efectivo disponible es insuficiente/),
  ).toBeVisible();
});
