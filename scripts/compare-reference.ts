/**
 * Screenshots the reference page and the running app for every zone in
 * day and night, diffs them pixel by pixel and writes the results to
 * test-results/compare/. Usage: tsx scripts/compare-reference.ts [url] [--webkit]
 * The app URL comes from the first non-flag argument, then SITE_URL, then
 * http://localhost:3200. The canvas region is #view minus the hotspot label boxes. Exits 1 if any canvas-region mismatch exceeds 0.5%.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, webkit, type Page } from "@playwright/test";
import sharp from "sharp";

const args = process.argv.slice(2);
const useWebkit = args.includes("--webkit");
const appUrl = (args.find((a) => !a.startsWith("--")) ?? process.env.SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
const refUrl = pathToFileURL(resolve("bisaat-club-walk-the-floor.html")).href;
const OUT = resolve("test-results/compare");
const ZONES = ["door", "ps5", "race", "games", "lib", "desk"];
const THRESHOLD = 8;
const CANVAS_LIMIT = 0.5;
const VIEWPORT = { width: 390, height: 844 };

type Region = { x: number; y: number; w: number; h: number };
type Row = { zone: string; mode: string; total: number; canvas: number; sheet: number; error?: string };

async function shoot(page: Page, url: string, file: string) {
  await page.goto(url);
  await page.waitForSelector("#title:not(:empty)");
  await page.addStyleTag({ content: "#count{visibility:hidden !important}" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: file });
  const box = async (sel: string): Promise<Region> => {
    const b = (await page.locator(sel).boundingBox())!;
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  // Hotspot labels are DOM text over the canvas, so they are excluded from the canvas region.
  const spots = await page.locator(".spot:visible").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.floor(r.x) - 1, y: Math.floor(r.y) - 1, w: Math.ceil(r.width) + 2, h: Math.ceil(r.height) + 2 };
    }),
  );
  return { view: await box("#view"), sheet: await box("#sheet"), spots };
}

async function raw(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const pct = (bad: number, total: number) => (total ? (bad / total) * 100 : 0);

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await (useWebkit ? webkit : chromium).launch();
  const rows: Row[] = [];
  for (const zone of ZONES) {
    for (const mode of ["day", "night"]) {
      const hash = mode === "night" ? `#${zone}-night` : `#${zone}`;
      const base = `${zone}-${mode}`;
      const row: Row = { zone, mode, total: 0, canvas: 0, sheet: 0 };
      try {
        const shots: Record<string, Awaited<ReturnType<typeof shoot>>> = {};
        for (const [label, url] of [["ref", refUrl], ["app", appUrl + "/"]] as const) {
          const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: "light" });
          const page = await ctx.newPage();
          shots[label] = await shoot(page, url + hash, `${OUT}/${base}-${label}.png`);
          await ctx.close();
        }
        const a = await raw(`${OUT}/${base}-ref.png`);
        const b = await raw(`${OUT}/${base}-app.png`);
        if (a.w !== b.w || a.h !== b.h) throw new Error(`size mismatch ${a.w}x${a.h} vs ${b.w}x${b.h}`);
        const diff = Buffer.alloc(a.w * a.h * 4);
        const inRegion = (r: Region, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
        const ref = shots.ref;
        let bad = 0, badCanvas = 0, badSheet = 0, nCanvas = 0, nSheet = 0;
        for (let y = 0; y < a.h; y++) {
          for (let x = 0; x < a.w; x++) {
            const i = (y * a.w + x) * 4;
            const c = inRegion(ref.view, x, y) && !ref.spots.some((r) => inRegion(r, x, y)), s = inRegion(ref.sheet, x, y);
            if (c) nCanvas++;
            if (s) nSheet++;
            let mismatch = false;
            for (let k = 0; k < 4; k++) if (Math.abs(a.data[i + k] - b.data[i + k]) > THRESHOLD) mismatch = true;
            if (mismatch) {
              bad++;
              if (c) badCanvas++;
              if (s) badSheet++;
              diff[i] = 255; diff[i + 1] = 0; diff[i + 2] = 0; diff[i + 3] = 255;
            } else {
              const g = Math.round((a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3 * 0.3 + 178);
              diff[i] = diff[i + 1] = diff[i + 2] = g; diff[i + 3] = 255;
            }
          }
        }
        await sharp(diff, { raw: { width: a.w, height: a.h, channels: 4 } }).png().toFile(`${OUT}/${base}-diff.png`);
        row.total = pct(bad, a.w * a.h);
        row.canvas = pct(badCanvas, nCanvas);
        row.sheet = pct(badSheet, nSheet);
      } catch (e) {
        row.error = (e as Error).message;
        row.total = row.canvas = row.sheet = 100;
      }
      rows.push(row);
    }
  }
  await browser.close();

  const f = (n: number) => n.toFixed(2) + "%";
  const lines = [
    `Reference vs ${appUrl} (${useWebkit ? "webkit" : "chromium"}, ${VIEWPORT.width}x${VIEWPORT.height}, channel tolerance ${THRESHOLD})`,
    "zone   | mode  | total   | canvas  | sheet",
    "-------|-------|---------|---------|--------",
    ...rows.map((r) => `${r.zone.padEnd(6)} | ${r.mode.padEnd(5)} | ${f(r.total).padStart(7)} | ${f(r.canvas).padStart(7)} | ${f(r.sheet).padStart(7)}${r.error ? "  ERROR " + r.error : ""}`),
  ];
  console.log(lines.join("\n"));

  const cell = (n: number) => `<td${n > CANVAS_LIMIT ? ' style="color:#b00"' : ""}>${f(n)}</td>`;
  const html = `<!doctype html><meta charset="utf-8"><title>Reference comparison</title>
<style>body{font:14px system-ui;margin:24px}td,th{padding:4px 10px;text-align:left}img{width:260px;border:1px solid #ccc}</style>
<h1>Reference vs app</h1><p>${lines[0]}</p>
<table><tr><th>Zone</th><th>Mode</th><th>Total</th><th>Canvas</th><th>Sheet</th><th>Reference</th><th>App</th><th>Diff</th></tr>
${rows.map((r) => `<tr><td>${r.zone}</td><td>${r.mode}</td>${cell(r.total)}${cell(r.canvas)}${cell(r.sheet)}` +
    ["ref", "app", "diff"].map((k) => `<td><img src="${r.zone}-${r.mode}-${k}.png"></td>`).join("") + "</tr>").join("\n")}
</table>`;
  writeFileSync(`${OUT}/index.html`, html);
  console.log(`\nWrote ${OUT}/index.html`);

  const failed = rows.filter((r) => r.canvas > CANVAS_LIMIT);
  if (failed.length) {
    console.error(`FAIL: canvas mismatch above ${CANVAS_LIMIT}% in ${failed.map((r) => r.zone + "-" + r.mode).join(", ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
