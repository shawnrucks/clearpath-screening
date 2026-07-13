import {defineConfig} from "@playwright/test";

const baseURL = (process.env.CLEARPATH_BASE_URL ?? "http://127.0.0.1:3010").replace(
  /\/$/,
  "",
);
const host = new URL(baseURL).hostname;

if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error(
    `Browser tests are restricted to a local ClearPath server; received ${baseURL}`,
  );
}

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {timeout: 7_500},
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    viewport: {width: 1440, height: 1000},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
