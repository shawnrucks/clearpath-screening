import {expect, test, type Page} from "@playwright/test";
import {
  captureRuntimeErrors,
  internalAccounts,
  loginAsRole,
  type InternalRole,
} from "./helpers";

async function resetLocalSeed(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
  const login = await page.request.post("/api/clearpath/login", {
    headers: {origin},
    data: {
      email: internalAccounts.Administrator,
      password: "demo123",
      role: "Administrator",
    },
  });
  expect(login.ok()).toBeTruthy();
  const sessionCookie = (await login.headersArray())
    .find(
      (header) =>
        header.name.toLowerCase() === "set-cookie" &&
        header.value.startsWith("cp_session="),
    )
    ?.value.split(";", 1)[0];
  expect(sessionCookie).toBeTruthy();
  const reset = await page.request.post("/api/demo/reset", {
    headers: {origin, cookie: sessionCookie!},
    data: {confirmation: "RESTORE_CLEARPATH_DEMO"},
  });
  expect(reset.ok()).toBeTruthy();
  await page.context().clearCookies();
}

async function startWorkflow(page: Page, role: InternalRole) {
  await loginAsRole(page, role);
}

function firstDesktopRow(page: Page) {
  return page.locator(".queue-table tbody tr").first();
}

test.describe("priority workflow persistence", () => {
  test.describe.configure({timeout: 60_000});

  test.beforeEach(async ({page}) => {
    await resetLocalSeed(page);
  });

  test.afterEach(async ({page}) => {
    await resetLocalSeed(page);
  });

  test("candidate request persists as an order communication after reload", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Operations Specialist");
    await page.goto("/app/queues/candidate-missing-information");

    const row = firstDesktopRow(page);
    const orderId = (await row.locator(".queue-record-links a").first().innerText()).trim();
    await row.getByRole("button", {name: "Send Candidate Request →"}).click();
    const dialog = page.getByRole("dialog", {name: "Send Candidate Request"});
    await dialog
      .getByLabel("Candidate message template")
      .selectOption({label: "Missing information request"});
    await dialog.getByLabel("Follow-up date").fill("2026-07-26");
    await dialog
      .getByLabel("Internal note")
      .fill("Browser E2E: candidate information request sent.");
    await dialog.getByRole("button", {name: "Send Candidate Request"}).click();
    await expect(dialog).toHaveCount(0, {timeout: 20_000});

    await page.goto(`/app/orders/${orderId}?tab=communications`);
    await expect(page.getByText("Additional screening information needed")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Additional screening information needed")).toBeVisible();
    runtime.expectClean();
  });

  test("unassigned search vendor assignment persists on the exact search", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Operations Specialist");
    await page.goto("/app/queues/unassigned-searches");

    const row = firstDesktopRow(page);
    const links = row.locator(".queue-record-links a");
    const searchId = (await links.first().innerText()).trim();
    const orderId = (await links.nth(1).innerText()).trim();
    await row.getByRole("button", {name: "Assign Vendor →"}).click();
    const dialog = page.getByRole("dialog", {name: "Assign Vendor"});
    const vendorSelect = dialog.getByLabel("Approved vendor");
    await vendorSelect.selectOption({index: 1});
    const vendorLabel = (await vendorSelect.locator("option:checked").innerText()).trim();
    const vendorName = vendorLabel.split(" · ")[0];
    await dialog.getByLabel("Due date").fill("2026-07-28");
    await dialog
      .getByLabel("Assignment note")
      .fill("Browser E2E: approved coverage, cost, and turnaround confirmed.");
    await dialog.getByRole("button", {name: "Assign Vendor"}).click();
    await expect(dialog).toHaveCount(0, {timeout: 20_000});

    await page.reload();
    await expect(
      page.locator(".queue-table tbody tr").filter({hasText: searchId}),
    ).toHaveCount(0);
    await page.goto(`/app/orders/${orderId}?tab=searches`);
    let search = page.locator(".order-search-row").filter({hasText: searchId});
    await expect(search).toContainText(vendorName);
    await page.reload();
    search = page.locator(".order-search-row").filter({hasText: searchId});
    await expect(search).toContainText(vendorName);
    runtime.expectClean();
  });

  test("overdue vendor contact is retained in the in-system message history", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Operations Specialist");
    await page.goto("/app/queues/overdue-searches");

    const row = firstDesktopRow(page);
    const searchId = (await row.locator(".queue-record-links a").first().innerText()).trim();
    const vendorName = (await row.locator("td").nth(7).innerText()).trim();
    const subject = `Browser E2E overdue escalation ${searchId}`;
    await row.getByRole("button", {name: "Contact Vendor →"}).click();
    const dialog = page.getByRole("dialog", {name: "Contact Vendor"});
    await dialog.getByLabel("Subject").fill(subject);
    await dialog
      .getByLabel("Message")
      .fill("Please confirm the outstanding source response and revised completion date.");
    await dialog.getByLabel("Follow-up date").fill("2026-07-24");
    await dialog.getByRole("button", {name: "Contact Vendor"}).click();
    await expect(dialog).toHaveCount(0, {timeout: 20_000});

    await page.goto("/app/vendors");
    let vendor = page.locator("article").filter({
      has: page.getByRole("heading", {name: vendorName, exact: true}),
    });
    await expect(vendor).toContainText(subject);
    await expect(vendor).toContainText(`Search: ${searchId}`);
    await page.reload();
    vendor = page.locator("article").filter({
      has: page.getByRole("heading", {name: vendorName, exact: true}),
    });
    await expect(vendor).toContainText(subject);
    await expect(vendor).toContainText("Follow-up: 2026-07-24");
    runtime.expectClean();
  });

  test("new order creation remains visible after detail and list reloads", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Operations Specialist");
    await page.goto("/app/orders");

    await page.getByRole("button", {name: /New Order$/}).click();
    const dialog = page.getByRole("dialog", {name: "Create a screening order"});
    await dialog.getByLabel("Full name").fill("Browser Persistence Candidate");
    await dialog.getByLabel("Date of birth").fill("1990-08-14");
    await dialog.getByLabel("SSN last 4").fill("2468");
    await dialog.getByLabel("Email address").fill("browser.persistence@example.com");
    await dialog.getByLabel("Phone number").fill("(303) 555-2468");
    await dialog.getByLabel("Current address").fill("2468 Test Lane, Denver, CO");
    await dialog.getByLabel("Client").selectOption({index: 1});
    await dialog.getByLabel("Position").fill("Screening Workflow Analyst");
    await dialog.getByLabel("Screening package").selectOption("Professional");
    await dialog.getByLabel("Recruiter").fill("Browser E2E");
    await dialog.getByLabel("Target completion").fill("2026-07-31");
    await dialog.getByRole("button", {name: "Create Order"}).click();

    await expect(page).toHaveURL(/\/app\/orders\/CP-\d{4}-\d+$/, {
      timeout: 20_000,
    });
    const orderId = new URL(page.url()).pathname.split("/").pop()!;
    await expect(
      page.getByRole("heading", {name: "Browser Persistence Candidate", level: 1}),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText(orderId, {exact: true})).toBeVisible();

    await page.goto("/app/orders");
    await page.getByRole("searchbox", {name: "Search orders"}).fill(orderId);
    let orderRow = page.locator(".orders-table tbody tr").filter({hasText: orderId});
    await expect(orderRow).toContainText("Browser Persistence Candidate");
    await page.reload();
    await page.getByRole("searchbox", {name: "Search orders"}).fill(orderId);
    orderRow = page.locator(".orders-table tbody tr").filter({hasText: orderId});
    await expect(orderRow).toContainText("Screening Workflow Analyst");
    runtime.expectClean();
  });

  test("candidate edits and order document metadata both persist after reload", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Operations Specialist");
    await page.goto("/app/orders");
    const orderId = (await page.locator(".orders-id-link").first().innerText()).trim();
    await page.goto(`/app/orders/${orderId}?tab=candidate`);

    await page.getByRole("button", {name: "Edit Candidate"}).click();
    let dialog = page.getByRole("dialog", {name: "Edit Candidate"});
    await dialog.getByLabel("Email", {exact: true}).fill("candidate.persisted@example.com");
    await dialog.getByLabel("Aliases").fill("Browser Persistence Alias");
    await dialog.getByRole("button", {name: "Save Candidate"}).click();
    await expect(page.getByRole("status")).toContainText("Candidate information updated");
    await page.reload();
    await expect(
      page.getByText("candidate.persisted@example.com", {exact: true}),
    ).toBeVisible();
    await expect(page.getByText("Browser Persistence Alias")).toBeVisible();

    await page.getByRole("tab", {name: /Documents/}).click();
    await page.getByRole("button", {name: "＋ Add Document"}).click();
    dialog = page.getByRole("dialog", {name: "Add Document Metadata"});
    await dialog.getByLabel("Choose file").setInputFiles({
      name: "browser-order-evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% ClearPath order fixture\n"),
    });
    await dialog.getByLabel("Document type").selectOption("QA Evidence");
    await dialog.getByRole("button", {name: "Record Document"}).click();
    await expect(page.getByRole("status")).toContainText("Document metadata added");
    await expect(page.getByText("browser-order-evidence.pdf")).toBeVisible();
    await page.reload();
    await expect(page.getByText("browser-order-evidence.pdf")).toBeVisible();
    await expect(page.getByText(/QA Evidence · application\/pdf/)).toBeVisible();
    runtime.expectClean();
  });

  test("verification attempt remains in the selected search history after reload", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Researcher / Vendor");
    await page.goto("/app/queues/verification-follow-up");

    let row = firstDesktopRow(page);
    const searchId = (await row.locator(".queue-record-links a").first().innerText()).trim();
    await row.getByRole("button", {name: "Log Verification Attempt →"}).click();
    let dialog = page.getByRole("dialog", {name: "Log Verification Attempt"});
    await dialog.getByLabel("Attempt type").selectOption("Email");
    await dialog.getByLabel("Outcome").selectOption("Left Message");
    await dialog.getByLabel("Next follow-up date").fill("2026-07-23");
    await dialog
      .getByLabel("Attempt note")
      .fill("Browser E2E: emailed the employer and left a callback request.");
    await dialog.getByRole("button", {name: "Log Verification Attempt"}).click();
    await expect(dialog).toHaveCount(0, {timeout: 20_000});

    await page.reload();
    row = page.locator(".queue-table tbody tr").filter({hasText: searchId});
    await row.getByRole("button", {name: "Log Verification Attempt →"}).click();
    dialog = page.getByRole("dialog", {name: "Log Verification Attempt"});
    await expect(dialog.locator(".queue-attempt-history")).toContainText(
      "Email · Left Message",
    );
    runtime.expectClean();
  });

  test("criminal review decision persists on the exact search", async ({page}) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Compliance Reviewer");
    await page.goto("/app/queues/record-review");

    const row = firstDesktopRow(page);
    const links = row.locator(".queue-record-links a");
    const searchId = (await links.first().innerText()).trim();
    const orderId = (await links.nth(1).innerText()).trim();
    await row.getByRole("button", {name: "Record Review Decision →"}).click();
    const dialog = page.getByRole("dialog", {name: "Record Review Decision"});
    await dialog.getByLabel("Review decision").selectOption("Send to Compliance Review");
    await dialog
      .getByLabel("Comparison rationale")
      .fill("Browser E2E: identifiers require a human reportability determination.");
    await dialog.getByRole("button", {name: "Record Review Decision"}).click();
    await expect(dialog).toHaveCount(0, {timeout: 20_000});

    await page.reload();
    await expect(
      page.locator(".queue-table tbody tr").filter({hasText: searchId}),
    ).toHaveCount(0);
    await page.goto(`/app/orders/${orderId}?tab=searches`);
    const search = page.locator(".order-search-row").filter({hasText: searchId});
    await expect(search).toContainText("Compliance Review");
    await expect(search).toContainText("Send to Compliance Review");
    runtime.expectClean();
  });

  test("QA checklist, approval, and explicit release persist on the selected QA record", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "QA Reviewer");
    await page.goto("/app/quality-review?qa=QA-803");

    const checklist = page.locator('.qa-checklist-item input[type="checkbox"]');
    await expect(checklist).toHaveCount(11, {timeout: 20_000});
    for (let index = 0; index < 11; index += 1) {
      if (!(await checklist.nth(index).isChecked())) await checklist.nth(index).check();
    }
    await page.getByRole("button", {name: "Save QA Checklist"}).click();
    await expect(page.getByRole("status")).toContainText("QA checklist saved for QA-803");
    await page.reload();
    await expect(checklist).toHaveCount(11);
    for (let index = 0; index < 11; index += 1) {
      await expect(checklist.nth(index)).toBeChecked();
    }

    await page.locator(".qa-decision-form select").selectOption("Approve");
    await page
      .getByLabel("Decision note", {exact: true})
      .fill("Browser E2E: all QA evidence reviewed.");
    await page.getByRole("button", {name: "Submit QA Decision"}).click();
    await expect(page.getByRole("status")).toContainText("Approve saved for QA-803");

    await page.goto("/app/queues/reports-ready-to-release");
    const releaseRow = page.locator(".queue-table tbody tr").filter({hasText: "QA-803"});
    await expect(releaseRow).toHaveCount(1);
    await releaseRow.getByRole("button", {name: "Release Report →"}).click();
    const releaseDialog = page.getByRole("dialog", {name: "Release Report"});
    await releaseDialog
      .getByLabel("Release note (optional)")
      .fill("Browser E2E: approved report released to the client.");
    await releaseDialog.getByRole("button", {name: "Release Report"}).click();
    await expect(releaseDialog).toHaveCount(0, {timeout: 20_000});

    await page.goto("/app/quality-review?qa=QA-803");
    await expect(page.locator(".qa-detail-head")).toContainText("Released");
    runtime.expectClean();
  });

  test("billing approval and corrected-fee resolution both persist", async ({page}) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Billing Specialist");
    await page.goto("/app/queues/billing-exceptions");

    let row = firstDesktopRow(page);
    const billingId = (await row.locator(".queue-record-links a").first().innerText()).trim();
    await row.getByRole("button", {name: "Resolve Billing Exception →"}).click();
    let dialog = page.getByRole("dialog", {name: "Resolve Billing Exception"});
    await dialog.getByRole("radio", {name: /Request client approval/}).check();
    await dialog.getByLabel("Requested amount").fill("73.00");
    await dialog
      .getByLabel("Approval reason")
      .fill("Browser E2E: documented fee exceeds the client approval threshold.");
    await dialog
      .getByLabel("Additional note")
      .fill("Client approval is required before invoicing.");
    await dialog.getByRole("button", {name: "Request Client Approval"}).click();
    await expect(dialog).toHaveCount(0, {timeout: 20_000});

    await page.reload();
    row = page.locator(".queue-table tbody tr").filter({hasText: billingId});
    await expect(row).toContainText("Approval Required");
    await row.getByRole("button", {name: "Resolve Billing Exception →"}).click();
    dialog = page.getByRole("dialog", {name: "Resolve Billing Exception"});
    await dialog
      .getByRole("spinbutton", {name: "Corrected fee", exact: true})
      .fill("35.00");
    await dialog
      .getByLabel("Resolution note", {exact: true})
      .fill("Browser E2E: corrected fee validated and exception resolved.");
    await dialog.getByRole("button", {name: "Resolve Billing Exception"}).click();
    await expect(dialog).toHaveCount(0, {timeout: 20_000});

    await page.reload();
    await expect(
      page.locator(".queue-table tbody tr").filter({hasText: billingId}),
    ).toHaveCount(0);
    runtime.expectClean();
  });

  test("operations report saves through the UI and remains on Reports after reload", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Operations Specialist");
    await page.goto("/app/reports/operations");

    const title = "Browser E2E Morning Operations Brief";
    const summary =
      "Browser E2E: workload, aging, completions, and staffing coverage reviewed.";
    await page.getByLabel("Report title").fill(title);
    await page.getByLabel("Executive summary").fill(summary);
    await page
      .getByLabel("High-priority issues and next actions")
      .fill("Owners will clear overdue vendor responses and QA releases before noon.");
    await page.getByRole("button", {name: "Save Operations Report"}).click();

    await expect(page).toHaveURL(/\/app\/reports$/, {timeout: 20_000});
    let report = page.locator(".saved-reports details").filter({hasText: title});
    await expect(report).toHaveCount(1);
    await report.locator("summary").click();
    await expect(report).toContainText(summary);
    await page.reload();
    report = page.locator(".saved-reports details").filter({hasText: title});
    await expect(report).toHaveCount(1);
    await report.locator("summary").click();
    await expect(report).toContainText("Owners will clear overdue vendor responses");
    runtime.expectClean();
  });

  test("client invoice creation remains in billing history after reload", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Billing Specialist");
    await page.goto("/app/billing");
    await page.getByRole("link", {name: "Open →"}).first().click();
    await expect(
      page.getByRole("heading", {name: "Create client invoice", level: 2}),
    ).toBeVisible();

    await page.getByLabel("Due date").fill("2026-08-15");
    await page.getByLabel("Description").fill("Browser E2E screening invoice");
    await page.getByLabel("Amount").fill("149.25");
    await page
      .getByLabel("Invoice note")
      .fill("Browser E2E: approved screening services ready for client billing.");
    await page.getByRole("button", {name: "Create invoice"}).click();
    const status = page.getByRole("status");
    await expect(status).toContainText(/Invoice INV-\d{4}-\d+ was saved/, {
      timeout: 20_000,
    });
    const invoiceNumber = (await status.innerText()).match(/INV-\d{4}-\d+/)?.[0];
    expect(invoiceNumber).toBeTruthy();

    let invoice = page.locator(".invoice-list article").filter({
      hasText: invoiceNumber!,
    });
    await expect(invoice).toContainText("$149.25");
    await page.reload();
    invoice = page.locator(".invoice-list article").filter({
      hasText: invoiceNumber!,
    });
    await expect(invoice).toContainText("Due 2026-08-15");
    await expect(invoice).toContainText("$149.25");
    runtime.expectClean();
  });

  test("operations reset control removes workflow changes and restores the seed", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await startWorkflow(page, "Operations Specialist");
    await page.goto("/app/queues/candidate-missing-information");

    const row = firstDesktopRow(page);
    const orderId = (await row.locator(".queue-record-links a").first().innerText()).trim();
    await row.getByRole("button", {name: "Send Candidate Request →"}).click();
    const dialog = page.getByRole("dialog", {name: "Send Candidate Request"});
    await dialog
      .getByLabel("Candidate message template")
      .selectOption({label: "Missing information request"});
    await dialog.getByLabel("Follow-up date").fill("2026-07-26");
    await dialog.getByLabel("Internal note").fill("Browser E2E reset marker");
    await dialog.getByRole("button", {name: "Send Candidate Request"}).click();
    await expect(dialog).toHaveCount(0, {timeout: 20_000});

    await page.goto(`/app/orders/${orderId}?tab=communications`);
    await expect(page.getByText("Additional screening information needed")).toBeVisible();
    await page.goto("/app/dashboard");
    await page.getByRole("button", {name: "Reseed demo data"}).click();
    await page.getByLabel("I understand that all changes in the shared demo will be replaced.").check();
    await page
      .getByRole("dialog", {name: "Reseed the shared demo environment?"})
      .getByRole("button", {name: "Reseed Demo Data", exact: true})
      .click();
    await expect(page.getByRole("status")).toContainText(
      "50 orders · 150 searches · 8 users · seed 2026.07.12.2",
    );

    await page.goto(`/app/orders/${orderId}?tab=communications`);
    await expect(page.getByText("Additional screening information needed")).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Additional screening information needed")).toHaveCount(0);
    runtime.expectClean();
  });
});
