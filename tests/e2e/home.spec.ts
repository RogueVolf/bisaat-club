import { expect, test } from "@playwright/test";
import { SEED } from "../../src/content/seed";

const { bookingUrl, bookingLabel } = SEED.settings;

test("home renders the canvas, title and booking link", async ({ page }) => {
  await page.goto("/");
  const gl = page.locator("canvas#gl");
  await expect(gl).toBeVisible();
  const box = await gl.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
  await expect(page.locator("#title")).toHaveText("Play. Read. Stay.");
  await expect(page.locator("#book")).toHaveAttribute("href", bookingUrl);
  await expect(page.locator("#book")).toHaveText(bookingLabel);
});

test("deep link #lib shows the reading room", async ({ page }) => {
  await page.goto("/#lib");
  await expect(page.locator("#title")).toHaveText("Reading room");
});

test("deep link #lib-night sets night mode", async ({ page }) => {
  await page.goto("/#lib-night");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "night");
});

test("tapping Next room walks to the PS5 corner", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#title")).toHaveText("Play. Read. Stay.");
  await page.locator("#next").tap();
  await expect(page.locator("#title")).toHaveText("PS5 corner");
});

test("without WebGL the fallback shows and the sheet still has text", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof orig;
  });
  await page.goto("/");
  await expect(page.locator("#nogl")).toBeVisible();
  await expect(page.locator("#title")).toHaveText("Play. Read. Stay.");
  await expect(page.locator("#body")).not.toBeEmpty();
  await expect(page.locator("#hint")).toBeHidden();
});

test("GET /admin is refused with 403", async ({ request }) => {
  expect((await request.get("/admin")).status()).toBe(403);
});

test("POST /api/content is refused with 405", async ({ request }) => {
  expect((await request.post("/api/content", { data: {} })).status()).toBe(405);
});
