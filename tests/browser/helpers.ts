import {expect, type Page} from "@playwright/test";

export const sidebarRoutes = [
  ["Dashboard", "/app/dashboard", "Operations Dashboard"],
  ["Orders", "/app/orders", "Orders"],
  ["Work Queues", "/app/queues", "Priority Queues"],
  ["Candidates", "/app/candidates", "Candidates"],
  ["Searches", "/app/searches", "Searches"],
  ["Quality Review", "/app/quality-review", "Quality Review"],
  ["Clients", "/app/clients", "Clients"],
  ["Vendors", "/app/vendors", "Vendor Directory"],
  ["Billing", "/app/billing", "Billing & Invoicing"],
  ["Reports", "/app/reports", "Reports"],
  ["Audit Log", "/app/audit-log", "Audit Log"],
  ["Administration", "/app/admin", "Administration"],
] as const;

export const queueRoutes = [
  ["New Order Review", "/app/queues/new-order-review", "Review Order", null],
  ["Candidate Missing Information", "/app/queues/candidate-missing-information", "Send Candidate Request", "Send Candidate Request"],
  ["Unassigned Searches", "/app/queues/unassigned-searches", "Assign Vendor", "Assign Vendor"],
  ["Verification Follow-Up", "/app/queues/verification-follow-up", "Log Verification Attempt", "Log Verification Attempt"],
  ["Overdue Searches", "/app/queues/overdue-searches", "Contact Vendor", "Contact Vendor"],
  ["Criminal Record Review", "/app/queues/record-review", "Record Review Decision", "Record Review Decision"],
  ["Reports Ready for QA", "/app/queues/reports-ready-for-qa", "Open QA Review", null],
  ["Reports Ready to Release", "/app/queues/reports-ready-to-release", "Release Report", "Release Report"],
  ["Billing Exceptions", "/app/queues/billing-exceptions", "Resolve Billing Exception", "Resolve Billing Exception"],
] as const;

export const internalAccounts = {
  Administrator: "admin@clearpath.local",
  "Operations Specialist": "operations@clearpath.local",
  "QA Reviewer": "qa@clearpath.local",
  "Researcher / Vendor": "researcher@clearpath.local",
  "Billing Specialist": "billing@clearpath.local",
  "Compliance Reviewer": "compliance@clearpath.local",
} as const;

export type InternalRole = keyof typeof internalAccounts;

export async function loginAsRole(page: Page, role: InternalRole) {
  await page.goto("/login");
  await page.getByLabel("Demo role").selectOption(role);
  await page.getByLabel("Email address").fill(internalAccounts[role]);
  await page.locator("#password").fill("demo123");
  await page.getByRole("button", {name: "Sign In →"}).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(
    page.getByRole("heading", {name: "Operations Dashboard", level: 1}),
  ).toBeVisible();
}

export async function loginAsAdministrator(page: Page) {
  await loginAsRole(page, "Administrator");
}

export function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const source = message.location().url;
      errors.push(`console: ${message.text()}${source ? ` (${source})` : ""}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return {
    errors,
    expectClean() {
      expect(errors, errors.join("\n")).toEqual([]);
    },
  };
}

export async function closeActionDialog(page: Page) {
  const dialog = page.getByRole("dialog");
  const close = dialog.getByRole("button", {name: /^Close/});
  await expect(close).toBeVisible();
  await close.click();
  await expect(dialog).toHaveCount(0);
}
