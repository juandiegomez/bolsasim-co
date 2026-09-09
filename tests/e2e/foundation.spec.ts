import { expect, test } from "@playwright/test";

test("FND-001: shell boots and remains usable on laptop and mobile", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "BolsaSim CO" }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Efectivo disponible", { exact: true })
        .or(page.getByRole("button", { name: "Iniciar simulación" })),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(
      "Capital ficticio",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Saltar al contenido" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  }
});

test("OBS-001/FND-001: real HTTP health propagates request ID and rejects writes", async ({
  request,
}) => {
  const health = await request.get("/api/v1/health", {
    headers: { "X-Request-Id": "e2e-request-1" },
  });
  expect(health.status()).toBe(200);
  expect(health.headers()["x-request-id"]).toBe("e2e-request-1");
  expect(health.headers()["cache-control"]).toBe("no-store");
  expect(await health.json()).toEqual({
    status: "ok",
    service: "bolsasim-co",
    requestId: "e2e-request-1",
  });
  const badId = await request.get("/api/v1/health", {
    headers: { "X-Request-Id": "<invalid>" },
  });
  expect(badId.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
  const mutation = await request.post("/api/v1/health");
  expect(mutation.status()).toBe(405);
  expect(await mutation.json()).toMatchObject({
    code: "METHOD_NOT_ALLOWED",
    requestId: mutation.headers()["x-request-id"],
  });
  const shell = await request.get("/");
  expect(shell.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
});
