/**
 * Screenshots the reference page and the running app for every zone in
 * day and night, diffs them pixel by pixel and writes the results to
 * test-results/compare/. Usage: tsx scripts/compare-reference.ts [url] [--webkit]
 * The app URL comes from the first non-flag argument, then E2E_BASE_URL (never SITE_URL, which
 * may point at production), then http://localhost:3200. Hotspot boxes must agree within 2 px; header
 * (#count masked) and sheet mismatch are each limited to 1.0%. Exits 1 if any canvas-region mismatch exceeds 0.5%.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, webkit, type Page } from "@playwright/test";
import sharp from "sharp";

const args = process.argv.slice(2);
const useWebkit = args.includes("--webkit");
const appUrl = (args.find((a) => !a.startsWith("--")) ?? process.env.E2E_BASE_URL ?? "http://localhost:3200").replace(/\/$/, "");
const refUrl = pathToFileURL(resolve("bisaat-club-walk-the-floor.html")).href;
const OUT = resolve("test-results/compare");
const ZONES = ["door", "ps5", "race", "games", "lib", "desk"];
const THRESHOLD = 8;
const CANVAS_LIMIT = 0.5;
const SHEET_LIMIT = 1.0;
const HEADER_LIMIT = 1.0;
const VIEWPORT = { width: 390, height: 844 };

type Region = { x: number; y: number; w: number; h: number };
type Row = { zone: string; mode: string; total: number; canvas: number; header: number; sheet: number; pills: number; spots: string; settle: string; error?: string };

type Spot = { go: string; x: number; y: number; w: number; h: number };

/** Waits for hydration, then screenshots every 150 ms until two consecutive frames are byte-identical. */
async function shoot(page: Page, url: string, file: string) {
  await page.goto(url);
  await page.waitForSelector("html[data-mode]");
  await page.waitForFunction(() => {
    const c = document.getElementById("gl") as HTMLCanvasElement | null;
    return !!c && c.width > 0 && c.height > 0;
  });
  // Web fonts (Google on the reference, next/font on the app) must be in before text is compared.
  await page.waitForFunction(() => document.fonts.status === "loaded" && document.fonts.check('600 13px "DM Sans"') && document.fonts.check('400 16px "DM Sans"'));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "#count{visibility:hidden !important}" });
  const t0 = Date.now();
  let prev = await page.screenshot();
  let settled = false;
  while (Date.now() - t0 < 5000) {
    await page.waitForTimeout(150);
    const cur = await page.screenshot();
    if (cur.equals(prev)) { settled = true; break; }
    prev = cur;
  }
  writeFileSync(file, prev);
  const settleMs = Date.now() - t0;
  const box = async (sel: string): Promise<Region> => {
    const b = (await page.locator(sel).boundingBox())!;
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const spots: Spot[] = await page.locator(".spot:visible").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { go: (e as HTMLElement).dataset.go ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  return { view: await box("#view"), header: await box("#top"), sheet: await box("#sheet"), spots, settleMs, settled };
}

/** Same visible spots on both sides, each box within 2 px. Returns a problem description or "". */
function spotProblem(a: Spot[], b: Spot[]) {
  const ka = a.map((s) => s.go).sort().join(","), kb = b.map((s) => s.go).sort().join(",");
  if (ka !== kb) return `visible spots differ: ref [${ka}] app [${kb}]`;
  for (const s of a) {
    const o = b.find((t) => t.go === s.go)!;
    const d = Math.max(Math.abs(s.x - o.x), Math.abs(s.y - o.y), Math.abs(s.w - o.w), Math.abs(s.h - o.h));
    if (d > 2) return `spot ${s.go} off by ${d.toFixed(1)}px`;
  }
  return "";
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
      const row: Row = { zone, mode, total: 0, canvas: 0, header: 0, sheet: 0, pills: 0, spots: "", settle: "" };
      try {
        const shots: Record<string, Awaited<ReturnType<typeof shoot>>> = {};
        for (const [label, url] of [["ref", refUrl], ["app", appUrl + "/"]] as const) {
          const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: mode === "night" ? "dark" : "light" });
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
        // Pill labels are fractional-x text over the canvas, and their edge and text rasterisation differs
        // from the reference (the spec allows this). Their geometry is gated by the spots check, so the
        // union of both pages' pill boxes, inflated by 2 px, is left out of the canvas metric and reported as a warning.
        const pills = [...shots.ref.spots, ...shots.app.spots].map((q) => ({ x: Math.floor(q.x) - 2, y: Math.floor(q.y) - 2, w: Math.ceil(q.w) + 4, h: Math.ceil(q.h) + 4 }));
        let bad = 0, badCanvas = 0, badSheet = 0, badHeader = 0, nCanvas = 0, nSheet = 0, nHeader = 0, badPill = 0, nPill = 0;
        for (let y = 0; y < a.h; y++) {
          for (let x = 0; x < a.w; x++) {
            const i = (y * a.w + x) * 4;
            const pill = pills.some((r) => inRegion(r, x, y));
            const c = inRegion(ref.view, x, y) && !pill, s = inRegion(ref.sheet, x, y), hd = inRegion(ref.header, x, y);
            if (hd) nHeader++;
            if (c) nCanvas++;
            if (s) nSheet++;
            const p = pill && inRegion(ref.view, x, y);
            if (p) nPill++;
            let mismatch = false;
            for (let k = 0; k < 4; k++) if (Math.abs(a.data[i + k] - b.data[i + k]) > THRESHOLD) mismatch = true;
            if (mismatch) {
              bad++;
              if (c) badCanvas++;
              if (p) badPill++;
              if (s) badSheet++;
              if (hd) badHeader++;
              diff[i] = 255; diff[i + 1] = 0; diff[i + 2] = 0; diff[i + 3] = 255;
            } else {
              const g = Math.round((a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3 * 0.3 + 178);
              diff[i] = diff[i + 1] = diff[i + 2] = g; diff[i + 3] = 255;
            }
          }
        }
        await sharp(diff, { raw: { width: a.w, height: a.h, channels: 4 } }).png().toFile(`${OUT}/${base}-diff.png`);
        row.spots = spotProblem(shots.ref.spots, shots.app.spots);
        row.settle = `${shots.ref.settleMs}/${shots.app.settleMs}ms${shots.ref.settled && shots.app.settled ? "" : " NOT SETTLED"}`;
        row.total = pct(bad, a.w * a.h);
        row.canvas = pct(badCanvas, nCanvas);
        row.header = pct(badHeader, nHeader);
        row.sheet = pct(badSheet, nSheet);
        row.pills = pct(badPill, nPill);
      } catch (e) {
        row.error = (e as Error).message;
        row.spots = "error";
        row.total = row.canvas = row.header = row.sheet = 100;
      }
      rows.push(row);
    }
  }
  await browser.close();

  const f = (n: number) => n.toFixed(2) + "%";
  const lines = [
    `Reference vs ${appUrl} (${useWebkit ? "webkit" : "chromium"}, ${VIEWPORT.width}x${VIEWPORT.height}, channel tolerance ${THRESHOLD})`,
    "zone   | mode  | total   | canvas  | header  | sheet   | pills (warn) | spots | settle ref/app",
    "-------|-------|---------|---------|---------|---------|--------------|-------|---------------",
    ...rows.map((r) => `${r.zone.padEnd(6)} | ${r.mode.padEnd(5)} | ${f(r.total).padStart(7)} | ${f(r.canvas).padStart(7)} | ${f(r.header).padStart(7)} | ${f(r.sheet).padStart(7)} | ${f(r.pills).padStart(12)} | ${(r.spots ? "FAIL" : "ok").padEnd(5)} | ${r.settle}${r.spots ? "  " + r.spots : ""}${r.error ? "  ERROR " + r.error : ""}`),
  ];
  console.log(lines.join("\n"));

  const cell = (n: number, lim = CANVAS_LIMIT) => `<td${n > lim ? ' style="color:#b00"' : ""}>${f(n)}</td>`;
  const html = `<!doctype html><meta charset="utf-8"><title>Reference comparison</title>
<style>body{font:14px system-ui;margin:24px}td,th{padding:4px 10px;text-align:left}img{width:260px;border:1px solid #ccc}</style>
<h1>Reference vs app</h1><p>${lines[0]}</p>
<table><tr><th>Zone</th><th>Mode</th><th>Total</th><th>Canvas</th><th>Header</th><th>Sheet</th><th>Pills (warn)</th><th>Spots</th><th>Settle</th><th>Reference</th><th>App</th><th>Diff</th></tr>
${rows.map((r) => `<tr><td>${r.zone}</td><td>${r.mode}</td>${cell(r.total)}${cell(r.canvas)}${cell(r.header, HEADER_LIMIT)}${cell(r.sheet, SHEET_LIMIT)}<td>${f(r.pills)}</td><td>${r.spots || "ok"}</td><td>${r.settle}</td>` +
    ["ref", "app", "diff"].map((k) => `<td><img src="${r.zone}-${r.mode}-${k}.png"></td>`).join("") + "</tr>").join("\n")}
</table>`;
  writeFileSync(`${OUT}/index.html`, html);
  console.log(`\nWrote ${OUT}/index.html`);

  const failed = rows.filter((r) => r.canvas > CANVAS_LIMIT || r.header > HEADER_LIMIT || r.sheet > SHEET_LIMIT || r.spots);
  if (failed.length) {
    console.error(`FAIL (canvas > ${CANVAS_LIMIT}%, header > ${HEADER_LIMIT}%, sheet > ${SHEET_LIMIT}% or hotspot mismatch): ${failed.map((r) => r.zone + "-" + r.mode).join(", ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
