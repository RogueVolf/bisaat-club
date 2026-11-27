import { defineConfig, devices } from "@playwright/test";

// Same production build as the main config, but MongoDB is unreachable. Runs after the main
// suite (see the test:e2e script) so the two servers never share .next/cache at the same time.
const PORT = 3201;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /fallback\.spec/,
  outputDir: "test-results/e2e-fallback",
  reporter: [["list"]],
  globalTeardown: "./tests/e2e/clear-content-cache.ts",
  use: { baseURL },
  projects: [{ name: "fallback", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
  webServer: {
    // unstable_cache persists in .next/cache, so clear it or this server could replay cached DB content.
    command: `rm -rf .next/cache/fetch-cache && npm start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { MONGODB_URI_READ: "mongodb://127.0.0.1:1/bisaat?serverSelectionTimeoutMS=500" },
  },
});
