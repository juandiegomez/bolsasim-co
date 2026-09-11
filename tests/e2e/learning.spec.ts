import { expect, test } from "@playwright/test";

const DEMO1 = "a1b2c3d4-0001-4a01-9a01-000000000001";

test("EDU-001: market metadata has an understandable explanation", async ({
  page,
}) => {
  await page.goto(`/instruments/${DEMO1}`);
  await expect(
    page.getByRole("link", { name: "Ver mi portafolio y movimientos" }),
  ).toBeVisible();
  const explanation = page.getByText("¿Qué significa este precio?");
  await expect(explanation).toBeVisible();
  await explanation.click();
  await expect(page.getByText(/Cierre sin ajustes automáticos/)).toBeVisible();
  await expect(page.getByText(/Dato de demostración incluido/)).toBeVisible();
});

test("EDU-001: historical simulation explains its assumptions", async ({
  page,
}) => {
  await page.goto("/simulator");
  const explanation = page.getByText("¿Qué está calculando esta simulación?");
  await expect(explanation).toBeVisible();
  await explanation.click();
  await expect(
    page.getByText(/No crea una compra en tu portafolio/),
  ).toBeVisible();
});
