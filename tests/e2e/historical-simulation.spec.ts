import { expect, test } from "@playwright/test";

test("HIST-001/002/003/UI-001/UI-002: runs a historical simulation without ledger effects", async ({
  page,
  request,
}) => {
  const before = await request.get("/api/v1/portfolio/transactions?limit=100");
  const beforeStatus = before.status();
  const beforeBody = await before.json().catch(() => null);

  await page.goto("/simulator");
  await expect(
    page.getByRole("heading", { level: 1, name: "Simulación histórica" }),
  ).toBeVisible();
  await expect(page.getByLabel("Acción")).toBeVisible();
  await page
    .getByRole("button", { name: "Simular inversión histórica" })
    .click();
  await expect(page.getByRole("heading", { name: /DEMO1/ })).toBeVisible();
  await expect(page.getByText("1200000.00 COP").first()).toBeVisible();
  await expect(page.getByText("20%", { exact: true })).toBeVisible();
  await expect(page.getByText("Datos demo", { exact: false })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByText("no crea movimientos", { exact: false }),
  ).toBeVisible();

  const after = await request.get("/api/v1/portfolio/transactions?limit=100");
  expect(after.status()).toBe(beforeStatus);
  const afterBody = await after.json().catch(() => null);
  expect({ ...afterBody, requestId: undefined }).toEqual({
    ...beforeBody,
    requestId: undefined,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("HIST-002/MDATA-002/UI-001: reports coverage errors visibly", async ({
  page,
}) => {
  await page.goto("/simulator");
  await page.getByLabel("Fecha inicial").fill("2020-01-01");
  await page
    .getByRole("button", { name: "Simular inversión histórica" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "cobertura" }),
  ).toBeVisible();
});
