import {expect, test, type Page} from "@playwright/test";
import {
  captureRuntimeErrors,
  internalAccounts,
  loginAsRole,
} from "./helpers";

const portalAccounts = {
  Candidate: "candidate@clearpath.local",
  "Client Administrator": "client.admin@clearpath.local",
} as const;

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
    data: {},
  });
  expect(reset.ok()).toBeTruthy();
  await page.context().clearCookies();
}

async function loginToPortal(
  page: Page,
  role: keyof typeof portalAccounts,
  destination: RegExp,
) {
  await page.goto("/login");
  await page.getByLabel("Demo role").selectOption(role);
  await page.getByLabel("Email address").fill(portalAccounts[role]);
  await page.locator("#password").fill("demo123");
  await page.getByRole("button", {name: "Sign In →"}).click();
  await expect(page).toHaveURL(destination);
}

test.describe("candidate, client, and vendor portals", () => {
  test.beforeEach(async ({page}) => {
    await resetLocalSeed(page);
  });

  test.afterEach(async ({page}) => {
    await resetLocalSeed(page);
  });

  test("candidate completes disclosure, signature, and document steps with reload persistence", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await loginToPortal(page, "Candidate", /\/candidate\/dashboard$/);

    await expect(
      page.getByRole("heading", {
        name: "Hi Alex, let’s complete your screening.",
        level: 1,
      }),
    ).toBeVisible();
    await page
      .getByRole("checkbox", {
        name: "I acknowledge that I have read and received this disclosure.",
      })
      .check();
    await page
      .getByRole("button", {name: "Accept disclosure and continue"})
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Disclosure acknowledged and saved",
    );
    await expect(
      page.getByRole("heading", {name: "Authorization signature", level: 2}),
    ).toBeVisible();

    await page.getByLabel("Electronic signature").fill("Alex Parker");
    await page.getByRole("button", {name: "Sign and continue"}).click();
    await expect(page.getByRole("status")).toContainText(
      "Authorization signature recorded",
    );
    await expect(
      page.getByRole("heading", {name: "Supporting documents", level: 2}),
    ).toBeVisible();

    await page.getByLabel("Document type").selectOption("Candidate Authorization");
    await page.getByLabel("Choose document").setInputFiles({
      name: "browser-authorization.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% ClearPath browser fixture\n"),
    });
    await page.getByRole("button", {name: "Record document"}).click();
    await expect(page.getByRole("status")).toContainText(
      "browser-authorization.pdf was recorded securely",
    );
    await expect(page.getByText("5 of 5 complete")).toBeVisible();
    await expect(
      page.getByText("browser-authorization.pdf", {exact: true}),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText("5 of 5 complete")).toBeVisible();
    await expect(
      page.getByText("browser-authorization.pdf", {exact: true}),
    ).toBeVisible();
    runtime.expectClean();
  });

  test("client submits an order that remains in its tenant order list after reload", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await loginToPortal(page, "Client Administrator", /\/client\/dashboard$/);

    await page
      .getByRole("button", {name: "+ Submit screening order"})
      .click();
    const dialog = page.getByRole("dialog", {name: "Submit an order"});
    await dialog.getByLabel("Legal name").fill("Portal Test Candidate");
    await dialog
      .getByLabel("Email address")
      .fill("portal.candidate@example.com");
    await dialog.getByLabel("Date of birth").fill("1991-04-18");
    await dialog.getByLabel("SSN last four").fill("4321");
    await dialog.getByLabel("Phone number").fill("(303) 555-4321");
    await dialog
      .getByLabel("Current address")
      .fill("4321 Portal Way, Denver, CO");
    await dialog.getByLabel("Position").fill("Operations Analyst");
    await dialog.getByLabel("Screening package").selectOption("Professional");
    await dialog.getByLabel("Recruiter").fill("Casey Martin");
    await dialog.getByLabel("Target completion").fill("2026-07-30");
    await dialog.getByLabel("Priority").selectOption("High");
    await dialog.getByRole("button", {name: "Submit order"}).click();

    await expect(page.getByRole("status")).toContainText(
      "was submitted for Portal Test Candidate",
    );
    let orderRow = page.locator("tbody tr").filter({
      hasText: "Portal Test Candidate",
    });
    await expect(orderRow).toHaveCount(1);
    await expect(orderRow).toContainText("Candidate Invited");

    await page.reload();
    orderRow = page.locator("tbody tr").filter({hasText: "Portal Test Candidate"});
    await expect(orderRow).toHaveCount(1);
    await expect(orderRow).toContainText("Operations Analyst");
    runtime.expectClean();
  });

  test("operations adds and edits a vendor with reload persistence", async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await loginAsRole(page, "Operations Specialist");
    await page.goto("/app/vendors");

    await page.getByRole("button", {name: "+ Add vendor"}).click();
    let dialog = page.getByRole("dialog", {name: "Add an approved vendor"});
    await dialog.getByLabel("Vendor name").fill("Front Range Screening");
    await dialog
      .getByLabel("Contact email")
      .fill("operations@frontrange.example");
    await dialog
      .getByLabel("Service coverage")
      .fill("Employment and education verification");
    await dialog.getByLabel("Jurisdictions").fill("CO, WY, NM");
    await dialog.getByLabel("Average turnaround").fill("1.8 days");
    await dialog.getByLabel("Standard cost").fill("28.50");
    await dialog.getByLabel("Quality score").fill("94");
    await dialog
      .getByRole("checkbox", {name: "Preferred vendor for matching coverage"})
      .check();
    await dialog.getByRole("button", {name: "Add vendor"}).click();
    await expect(page.getByRole("status")).toContainText(
      "Front Range Screening was added",
    );

    let vendorCard = page.locator("article").filter({
      has: page.getByRole("heading", {name: "Front Range Screening"}),
    });
    await expect(vendorCard).toHaveCount(1);
    await vendorCard.getByRole("button", {name: "Edit vendor"}).click();
    dialog = page.getByRole("dialog", {name: "Edit Front Range Screening"});
    await dialog.getByLabel("Quality score").fill("98");
    await dialog
      .getByLabel("Change note (optional)")
      .fill("Browser E2E: quality score confirmed after quarterly review.");
    await dialog.getByRole("button", {name: "Save vendor"}).click();
    await expect(page.getByRole("status")).toContainText(
      "Front Range Screening was updated",
    );

    await page.reload();
    vendorCard = page.locator("article").filter({
      has: page.getByRole("heading", {name: "Front Range Screening"}),
    });
    await expect(vendorCard).toContainText("98%");
    await expect(vendorCard).toContainText("★ Preferred");
    runtime.expectClean();
  });
});
