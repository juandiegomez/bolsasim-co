import { expect, test } from "@playwright/test";

test("INST-001/MDATA-001/UI-002: explore lists instruments with demo provenance", async ({
  page,
}) => {
  await page.goto("/instruments");
  await expect(
    page.getByRole("heading", { level: 1, name: "Instrumentos" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(
    page.getByRole("list").getByRole("link", { name: /DEMO1/ }),
  ).toBeVisible();
  await expect(
    page.locator(".badge", { hasText: "demo" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("nunca representan precios reales", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("UI-001: empty searches report an explicit state", async ({ page }) => {
  await page.goto("/instruments");
  await page.getByRole("searchbox").fill("ZZZZZZ");
  await expect(
    page.getByText(/No hay instrumentos que coincidan con/),
  ).toBeVisible();
});

test("INST-001/MDATA-001: detail shows latest close, session, basis and history", async ({
  page,
}) => {
  await page.goto("/instruments");
  await page.getByRole("link", { name: /DEMO1/ }).click();
  await expect(
    page.getByText("Último cierre disponible", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".balance")).toHaveText("120");
  await expect(
    page.getByText(
      /Cierre del 28 de agosto de 2026 · COP · dato demo educativo/,
    ),
  ).toBeVisible();
  const chart = page.locator('[role="img"][aria-label*="Gráfica de cierres"]');
  await expect(chart).toBeVisible();
  await expect(chart.locator("svg")).toBeVisible();
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThanOrEqual(15);
  await expect(page.getByRole("caption")).toContainText("DEMO1");
});

test("UI-001/MDATA-002: unknown instruments surface a controlled error", async ({
  page,
}) => {
  await page.goto("/instruments/ffffffff-ffff-4fff-8fff-ffffffffffff");
  await expect(
    page.getByText("El instrumento solicitado no existe."),
  ).toBeVisible();
});
