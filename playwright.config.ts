import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const FALLBACK_PORT = 3201;
const baseURL = process.env.SITE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/e2e",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL },
  projects: [
    { name: "iphone-13", testIgnore: /fallback\.spec/, use: { ...devices["iPhone 13"] } },
    { name: "iphone-se", testIgnore: /fallback\.spec/, use: { ...devices["iPhone SE"] } },
    {
      name: "chromium-390",
      testIgnore: /fallback\.spec/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // Same build, MongoDB unreachable: the page must serve the bundled content.
      name: "fallback",
      testMatch: /fallback\.spec/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, baseURL: `http://localhost:${FALLBACK_PORT}` },
    },
  ],
  webServer: [{
    command: `npm run build && npm start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  {
    // unstable_cache persists in .next/cache, so clear it or this server could replay DB content cached by the main one.
    command: `rm -rf .next/cache/fetch-cache && npm start -- -p ${FALLBACK_PORT}`,
    url: `http://localhost:${FALLBACK_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { MONGODB_URI_READ: "mongodb://127.0.0.1:1/bisaat?serverSelectionTimeoutMS=500" },
  }],
});
