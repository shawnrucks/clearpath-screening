import {expect, test} from "@playwright/test";
import {loginAsAdministrator} from "./helpers";

test.describe("order UI quality audit", () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdministrator(page);
  });

  test("core order creation, editing, tabs, and add-search controls are interactive", async ({
    page,
  }) => {
    await page.goto("/app/orders");
    const newOrder = page.getByRole("button", {name: /New Order$/});
    await expect(newOrder).toBeEnabled();
    await newOrder.click();
    await expect(
      page.getByRole("dialog", {name: "Create a screening order"}),
    ).toBeVisible();
    await page.getByRole("button", {name: "Cancel"}).click();

    await page.goto("/app/orders/CP-2026-1001");
    await expect(page.getByRole("button", {name: /Add Search$/})).toBeEnabled();
    await expect(page.getByRole("button", {name: "Edit Order"})).toBeEnabled();
    await expect(page.getByRole("button", {name: "Edit", exact: true})).toBeEnabled();

    const expectedTabs = [
      "overview",
      "searches",
      "candidate",
      "documents",
      "communications",
      "notes",
      "billing",
      "audit",
    ];
    await expect(page.getByRole("tab")).toHaveCount(expectedTabs.length);
    for (const tab of expectedTabs) {
      await expect(
        page.locator(`.order-tabs a[href="/app/orders/CP-2026-1001?tab=${tab}"]`),
      ).toBeEnabled();
    }
  });

  test("order detail cards and search rows have intentional spacing without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/app/orders/CP-2026-1001");
    const layout = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".order-detail-layout");
      const list = document.querySelector<HTMLElement>(".order-search-list");
      const row = document.querySelector<HTMLElement>(".order-search-list > article");
      if (!grid || !list || !row) return null;
      const gridStyle = getComputedStyle(grid);
      const rowStyle = getComputedStyle(row);
      const listRect = list.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      return {
        viewportOverflow: document.documentElement.scrollWidth - window.innerWidth,
        gridGap: Number.parseFloat(gridStyle.columnGap),
        rowDisplay: rowStyle.display,
        rowPaddingLeft: Number.parseFloat(rowStyle.paddingLeft),
        rowInset: rowRect.left - listRect.left,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.viewportOverflow).toBeLessThanOrEqual(1);
    expect(layout!.gridGap).toBeGreaterThanOrEqual(12);
    expect(["flex", "grid"]).toContain(layout!.rowDisplay);
    expect(Math.max(layout!.rowPaddingLeft, layout!.rowInset)).toBeGreaterThanOrEqual(12);
  });
});
