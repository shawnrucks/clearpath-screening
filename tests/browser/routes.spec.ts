import {expect, test} from "@playwright/test";
import {
  captureRuntimeErrors,
  loginAsAdministrator,
  queueRoutes,
  sidebarRoutes,
} from "./helpers";

test.describe("authentication", () => {
  test("login form and password visibility control work", async ({page}) => {
    const runtime = captureRuntimeErrors(page);
    await page.goto("/login");

    const password = page.locator("#password");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", {name: "Show password"}).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", {name: "Hide password"}).click();

    await page.getByLabel("Demo role").selectOption("Administrator");
    await page.getByLabel("Email address").fill("admin@clearpath.local");
    await password.fill("demo123");
    await page.getByRole("button", {name: "Sign In →"}).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    runtime.expectClean();
  });
});

test.describe("sidebar routes", () => {
  for (const [label, route, heading] of sidebarRoutes) {
    test(`${label} navigates to ${route}`, async ({page}) => {
      const runtime = captureRuntimeErrors(page);
      await loginAsAdministrator(page);

      const navigation = page.getByRole("navigation", {
        name: "Operations navigation",
      });
      const link = navigation.locator(`a[href="${route}"]`);
      await expect(link).toHaveCount(1);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
      await expect(
        page.getByRole("heading", {name: heading, level: 1}),
      ).toBeVisible();
      await expect(page.getByText("This page could not be found.")).toHaveCount(0);
      runtime.expectClean();
    });
  }
});

test("opening a client scopes the orders workspace to that client", async ({page}) => {
  const runtime = captureRuntimeErrors(page);
  await loginAsAdministrator(page);
  await page.goto("/app/clients");

  const clientRow = page.locator("tbody tr").first();
  const clientName = (await clientRow.locator("td").first().innerText()).trim();
  await clientRow.getByRole("link", {name: clientName, exact: true}).click();

  await expect(page).toHaveURL(/\/app\/orders\?client=/);
  await expect(page.getByRole("searchbox", {name: "Search orders"})).toHaveValue(
    clientName,
  );
  const orderRows = page.locator(".orders-table tbody tr");
  await expect.poll(() => orderRows.count()).toBeGreaterThan(0);
  for (const row of await orderRows.all()) await expect(row).toContainText(clientName);
  runtime.expectClean();
});

test.describe("queue routes", () => {
  for (const [heading, route] of queueRoutes) {
    test(`${heading} loads records without an application error`, async ({
      page,
    }) => {
      const runtime = captureRuntimeErrors(page);
      await loginAsAdministrator(page);
      await page.goto("/app/queues");

      const card = page.locator(`a[href="${route}"]`);
      await expect(card).toHaveCount(1);
      await card.click();
      await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
      await expect(
        page.getByRole("heading", {name: heading, level: 1}),
      ).toBeVisible();
      await expect(page.locator(".form-error")).toHaveCount(0);
      await expect(page.getByText("Unable to load this queue")).toHaveCount(0);
      await expect
        .poll(() => page.locator("tbody tr").count(), {
          message: `${heading} should contain seeded queue rows`,
        })
        .toBeGreaterThan(0);
      runtime.expectClean();
    });
  }
});

test("reports-ready-to-release uses the canonical route and renders seeded approved records", async ({
  page,
}) => {
  const runtime = captureRuntimeErrors(page);
  await loginAsAdministrator(page);
  await page.goto("/app/queues/reports-ready-to-release");

  await expect(
    page.getByRole("heading", {name: "Reports Ready to Release", level: 1}),
  ).toBeVisible();
  await expect(page.locator(".form-error")).toHaveCount(0);
  await expect(page.getByText("Unable to load this queue")).toHaveCount(0);
  await expect.poll(() => page.locator("tbody tr").count()).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", {name: "Release Report →"}).first(),
  ).toBeVisible();
  runtime.expectClean();
});
