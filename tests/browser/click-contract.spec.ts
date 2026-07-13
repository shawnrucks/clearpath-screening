import {expect, test, type Page} from "@playwright/test";
import {
  captureRuntimeErrors,
  closeActionDialog,
  loginAsAdministrator,
  queueRoutes,
  sidebarRoutes,
} from "./helpers";

async function expectActionDialog(page: Page, trigger: string, title: string) {
  const buttons = page
    .getByRole("button", {name: trigger, exact: true})
    .or(page.getByRole("button", {name: `${trigger} →`, exact: true}));
  await expect.poll(() => buttons.count()).toBeGreaterThan(0);
  await buttons.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", {name: title})).toBeVisible();
  await closeActionDialog(page);
}

test.describe("safe click contracts", () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdministrator(page);
  });

  test("global search, help, notifications, and user menu respond", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);

    await page.getByRole("button", {name: "Search ClearPath"}).click();
    const searchDialog = page.getByRole("dialog", {name: "Search ClearPath"});
    await expect(searchDialog).toBeVisible();
    await searchDialog.getByLabel("Search workspaces").fill("Orders");
    await expect(searchDialog.locator('a[href="/app/orders"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchDialog).toHaveCount(0);

    await page
      .getByRole("button", {name: "Help and keyboard shortcuts"})
      .click();
    await expect(page.getByText("ClearPath help")).toBeVisible();
    await page
      .getByRole("button", {name: "Notifications, 3 unread"})
      .click();
    await expect(page.getByText("Notifications", {exact: true})).toBeVisible();
    await expect(page.locator(".notice-popover a")).toHaveCount(3);

    await page.locator("button.side-user").click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem", {name: "Sign out"})).toBeVisible();
    runtime.expectClean();
  });

  test("reseed confirmation, failure recovery, and keyboard focus remain safe", async ({
    page,
  }) => {
    await page.goto("/app/dashboard");
    const trigger = page.getByRole("button", {name: "Reseed demo data"});
    await trigger.click();
    const dialog = page.getByRole("dialog", {name: "Reseed the shared demo environment?"});
    const confirm = dialog.getByRole("button", {name: "Reseed Demo Data"});
    const cancel = dialog.getByRole("button", {name: "Keep Current Data"});
    await expect(confirm).toBeDisabled();
    expect((await cancel.boundingBox())?.width).toBeGreaterThanOrEqual(138);
    expect((await confirm.boundingBox())?.width).toBeGreaterThanOrEqual(138);
    await cancel.click();
    await expect(trigger).toBeFocused();

    await page.route("**/api/demo/reset", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({error: "A demo data restoration is already running."}),
      });
    });
    await trigger.click();
    await dialog
      .getByLabel("I understand that all changes in the shared demo will be replaced.")
      .check();
    await confirm.click();
    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("Another reseed is already running");
    await expect(alert).toBeFocused();
    await expect(confirm).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.unroute("**/api/demo/reset");

    await page.setViewportSize({width: 390, height: 844});
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("class", /demo-reset-header/);
    await trigger.click();
    const mobileCancel = dialog.getByRole("button", {name: "Keep Current Data"});
    const mobileConfirm = dialog.getByRole("button", {name: "Reseed Demo Data"});
    const mobileCancelBox = await mobileCancel.boundingBox();
    const mobileConfirmBox = await mobileConfirm.boundingBox();
    expect(mobileCancelBox?.width).toBeGreaterThan(300);
    expect(mobileConfirmBox?.width).toBeGreaterThan(300);
    expect(mobileConfirmBox!.y).toBeGreaterThan(mobileCancelBox!.y);
    await mobileCancel.click();
  });

  test("orders export and every enabled order action type responds", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await page.goto("/app/orders");

    await page.getByRole("button", {name: /New Order$/}).click();
    await expect(
      page.getByRole("dialog", {name: "Create a screening order"}),
    ).toBeVisible();
    await page.getByRole("button", {name: "Cancel"}).click();

    const orderSearch = page.getByRole("searchbox", {name: "Search orders"});
    await orderSearch.fill("CP-2026-1001");
    await expect(page.locator(".orders-table tbody tr")).toHaveCount(1);
    await page.getByRole("button", {name: "Clear (1)"}).click();

    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", {name: "Export CSV"}).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("clearpath-orders.csv");

    const firstOrderLink = page.locator(".orders-id-link").first();
    const firstOrderId = (await firstOrderLink.innerText()).trim();
    await firstOrderLink.click();
    await expect(page).toHaveURL(new RegExp(`/app/orders/${firstOrderId}$`));
    await expectActionDialog(page, "Add Note", "Add Internal Note");
    await expectActionDialog(page, "Change Status", "Change Order Status");
    await expectActionDialog(page, "Send to QA", "Send Order to QA");
    await expectActionDialog(page, "Edit Order", "Edit Order");
    await expectActionDialog(page, "Edit", "Edit Candidate");
    await expectActionDialog(page, "＋ Add Search", "Add Search");

    const openSearch = page.getByRole("button", {name: /^Open search SRC-/});
    await expect.poll(() => openSearch.count()).toBeGreaterThan(0);
    await openSearch.first().click();
    await expect(
      page.getByRole("dialog").getByRole("heading", {name: /^Update SRC-/}),
    ).toBeVisible();
    await closeActionDialog(page);
    runtime.expectClean();
  });

  test("every queue row action type opens its expected workflow dialog", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    for (const [, route, trigger, title] of queueRoutes) {
      await page.goto(route);
      if (title) {
        await expectActionDialog(page, trigger, title);
      } else {
        await expect(page.getByRole("link", {name: `${trigger} →`}).first()).toBeVisible();
      }
    }
    runtime.expectClean();
  });

  test("quality review, vendor contact, billing composer, reports, audit, and reset respond safely", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);

    await page.goto("/app/quality-review");
    const checklist = page.locator('.qa-checklist-item input[type="checkbox"]');
    await expect.poll(() => checklist.count()).toBeGreaterThan(0);
    const unchecked = page
      .locator('.qa-checklist-item input[type="checkbox"]:not(:checked)')
      .first();
    await unchecked.check();
    await expect(page.getByRole("button", {name: "Save QA Checklist"})).toBeEnabled();
    await page.reload();

    await page.goto("/app/vendors");
    const contact = page.getByRole("button", {name: "Contact Vendor"});
    await expect.poll(() => contact.count()).toBeGreaterThan(0);
    await contact.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", {name: "Cancel"}).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const refresh = page.getByRole("button", {name: "Refresh"}).first();
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(refresh).toBeEnabled();

    await page.goto("/app/billing");
    await page.getByRole("link", {name: "Open →"}).first().click();
    await expect(page.getByRole("heading", {name: "Create client invoice"})).toBeVisible();
    await page.getByRole("button", {name: "+ Add line item"}).click();
    const removeSecond = page.getByRole("button", {name: "Remove line item 2"});
    await expect(removeSecond).toBeVisible();
    await removeSecond.click();
    await expect(removeSecond).toHaveCount(0);

    await page.goto("/app/reports");
    await page.getByRole("link", {name: "+ Create Operations Report"}).click();
    await expect(
      page.getByRole("heading", {name: "Create Operations Report", level: 1}),
    ).toBeVisible();
    await page.getByRole("button", {name: "Cancel"}).click();
    await expect(page).toHaveURL(/\/app\/reports$/);

    await page.goto("/app/audit-log");
    const auditDownloadEvent = page.waitForEvent("download");
    await page.getByRole("button", {name: "Export"}).click();
    const auditDownload = await auditDownloadEvent;
    expect(auditDownload.suggestedFilename()).toBe("clearpath-audit-log.csv");

    await page.goto("/app/admin");
    await page.getByRole("button", {name: "↻ Reseed demo data…"}).click();
    await expect(page.getByRole("dialog", {name: "Reseed the shared demo environment?"})).toBeVisible();
    await page.getByRole("button", {name: "Keep Current Data"}).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    runtime.expectClean();
  });

  test("enabled controls are named and links have destinations across every workspace", async ({
    page,
  }) => {
    const context = page.context();
    for (const [, route] of sidebarRoutes) {
      const routePage = await context.newPage();
      await routePage.goto(route, {waitUntil: "domcontentloaded"});
      const unnamed = await routePage.locator("button:not([disabled])").evaluateAll((buttons) =>
        buttons
          .filter(
            (button) =>
              !(button.getAttribute("aria-label") || button.textContent || "").trim(),
          )
          .map((button) => button.outerHTML.slice(0, 180)),
      );
      expect(unnamed, `${route} has unnamed enabled buttons`).toEqual([]);
      const emptyLinks = await routePage.locator("a").evaluateAll((links) =>
        links
          .filter((link) => !link.getAttribute("href"))
          .map((link) => link.outerHTML.slice(0, 180)),
      );
      expect(emptyLinks, `${route} has links without destinations`).toEqual([]);
      await routePage.close();
    }
  });
});
