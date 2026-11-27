import { expect, test } from "@playwright/test";
import { SEED } from "../../src/content/seed";

// Runs only in the "fallback" project, whose server cannot reach MongoDB.
const { bookingUrl, bookingLabel } = SEED.settings;

test("with the database unreachable the homepage serves the bundled content", async ({ page }) => {
  const res = await page.goto("/");
  expect(res!.status()).toBe(200);
  await expect(page.locator("#title")).toHaveText("Play. Read. Stay.");
  await expect(page.locator("#book")).toHaveAttribute("href", bookingUrl);
  await expect(page.locator("#book")).toHaveText(bookingLabel);
});

test("/api/content reports the fallback source", async ({ request }) => {
  const res = await request.get("/api/content");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('"source":"fallback"');
});
