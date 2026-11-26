/**
 * iPhone measurement for the walk-through, in Playwright WebKit with the iPhone device descriptors.
 *
 *   npm run measure:iphone -- [url] [--json out.json] [--capture dir] [--strip-uir]
 *   npm run measure:iphone -- --diff beforeDir afterDir
 *   npm run measure:iphone -- [url] --modes-only      (just the dark-mode first-paint table)
 *
 * The URL comes from the first argument, then SITE_URL, then http://localhost:3100. Run it against
 * `npm run build && npm start -p 3100`. Per device (portrait and landscape) it prints:
 *   - rAF frame times (median / p95) during a `#next` walk and a 1 s touch drag, and how many draws were
 *     low-res vs full-res (a draw is low-res when the backing width is below round(viewW * min(dpr, 2)));
 *   - time from navigation start to the first room frame, and that minus DOMContentLoaded;
 *   - app rAF callbacks and draws per second while idle;
 *   - tap: a press and release on #view with no movement. "blank ms" is the longest time the canvas
 *     backing was reallocated (which clears it) without a draw following; "held black %" is the share of
 *     pure-black pixels in #view while a press is held still (a blank canvas is pure black);
 *   - whether the document scrolls, console errors and CSP violations;
 *   - a WebGL context lose/restore (WEBGL_lose_context): is the room drawn again afterwards;
 *   - dark mode before first paint: for dark scheme and #...-night links, the sheet colour of the first frame,
 *     when it settles, and the sheet pixel of a screenshot taken right at DOMContentLoaded;
 *   - homepage transfer bytes (encoded body + headers) split into document, JS, CSS, font and image.
 *
 * --capture dir: at rest, saves the canvas pixels (read back right after the draw) and full-page
 *   screenshots for #door, #lib and #lib-night at 390x844, plus 1280x800 screenshots, with the clock frozen.
 * --diff a b: compares two capture dirs pixel by pixel (raw RGBA via sharp) and prints mismatches.
 * --strip-uir: removes `upgrade-insecure-requests` from the document CSP. Only needed for builds from
 *   before that directive became HTTPS-only; WebKit otherwise upgrades http://localhost and the page dies.
 *
 * Headless WebKit on a Mac is not an iPhone GPU: use these numbers to compare builds, not as device data.
 */
import { get } from "node:http";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { devices, webkit, type Browser, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const positional = argv.filter((a, i) => !a.startsWith("--") && !["--json", "--capture", "--diff"].includes(argv[i - 1] ?? ""));
const BASE = (positional[0] ?? process.env.SITE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const FROZEN = new Date("2026-11-27T10:00:00+05:30");

const DEVICES = ["iPhone 15 Pro", "iPhone 15 Pro landscape", "iPhone SE", "iPhone SE landscape", "iPhone SE (3rd gen)", "iPhone SE (3rd gen) landscape"];

/* In-page code is kept as plain JS strings so the TS transpiler cannot inject helpers into it. */
const INIT = `
  window.__m = { csp: [], ev: [], raf: 0, cap: false, capData: null };
  document.addEventListener('securitypolicyviolation', (e) => window.__m.csp.push(e.violatedDirective + ' ' + e.blockedURI));
  const ev = window.__m.ev;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { window.__m.raf++; return raf(cb); };
  window.__mRaf = raf; // the measurement's own loop uses this, so it is not counted as app frames
  const wd = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', { configurable: true, get() { return wd.get.call(this); },
    set(v) { if (this.id === 'gl' && wd.get.call(this) !== v) ev.push({ k: 'resize', t: performance.now(), w: v }); wd.set.call(this, v); } });
  const draw = WebGLRenderingContext.prototype.drawArrays;
  WebGLRenderingContext.prototype.drawArrays = function (...a) {
    const r = draw.apply(this, a);
    ev.push({ k: 'draw', t: performance.now(), w: this.canvas.width });
    if (window.__m.cap) { const w = this.drawingBufferWidth, h = this.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      this.readPixels(0, 0, w, h, this.RGBA, this.UNSIGNED_BYTE, px); window.__m.capData = { w, h, px }; window.__m.cap = false; }
    return r;
  };
`;

const STRIP_UIR = flag("--strip-uir");

/** Logs #sheet's background colour on every frame from the very first one, to see what was painted first and when it settled. */
const SHEET_LOG = `
  window.__sheet = [];
  const poll = () => { const s = document.getElementById('sheet');
    if (s) { const c = getComputedStyle(s).backgroundColor, l = window.__sheet; if (!l.length || l[l.length - 1].c !== c) l.push({ t: Math.round(performance.now()), c }); }
    if (performance.now() < 4000) requestAnimationFrame(poll); };
  requestAnimationFrame(poll);
`;
const MODE_CASES: { name: string; path: string; scheme: "light" | "dark"; want: "night" | "day" }[] = [
  { name: "dark scheme, /", path: "/", scheme: "dark", want: "night" },
  { name: "light scheme, /#lib-night", path: "/#lib-night", scheme: "light", want: "night" },
  { name: "dark scheme, /#lib-day", path: "/#lib-day", scheme: "dark", want: "day" },
  { name: "light scheme, /", path: "/", scheme: "light", want: "day" },
];
const SHEET_RGB = { night: "rgb(31, 42, 68)", day: "rgb(243, 235, 221)" };

/** First painted sheet colour, settle time (last colour change), an early screenshot's sheet pixel, CSP violations. */
async function modeCheck(browser: Browser) {
  const out: string[] = [];
  const { defaultBrowserType: _b, ...desc } = devices["iPhone 15 Pro"]; void _b;
  for (const c of MODE_CASES) {
    const ctx = await newContext(browser, desc, { colorScheme: c.scheme });
    await ctx.addInitScript({ content: SHEET_LOG });
    const page = await ctx.newPage();
    await page.goto(BASE + c.path, { waitUntil: "domcontentloaded" });
    const shot = await page.screenshot();
    await sleep(3000);
    const log = await page.evaluate("window.__sheet") as { t: number; c: string }[];
    const csp = await page.evaluate("window.__m.csp") as string[];
    const mode = await page.evaluate("document.documentElement.dataset.mode") as string;
    const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = ((info.height - 40) * info.width + Math.round(info.width / 2)) * info.channels; // inside the sheet, near the bottom
    const early = `rgb(${data[at]}, ${data[at + 1]}, ${data[at + 2]})`;
    const first = log[0]?.c ?? "none", settled = log[log.length - 1];
    const ok = first === SHEET_RGB[c.want] && settled?.c === SHEET_RGB[c.want] && mode === c.want && csp.length === 0;
    out.push(`| ${c.name} | ${c.want} | ${first} | ${log.length > 1 ? settled.t : log[0]?.t ?? "-"} | ${log.length - 1} | ${early} | ${csp.length} | ${ok ? "ok" : "FAIL"} |`);
    await ctx.close();
  }
  return out;
}

async function newContext(browser: Browser, desc: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({ ...desc, colorScheme: "light", ...extra });
  await ctx.addInitScript({ content: INIT });
  if (STRIP_UIR) {
    await ctx.route((u) => u.origin === new URL(BASE).origin && !u.pathname.startsWith("/_next") && !u.pathname.startsWith("/brand"), async (route) => {
      const res = await route.fetch(); const h = res.headers();
      if (h["content-security-policy"]) h["content-security-policy"] = h["content-security-policy"].replace(/;\s*upgrade-insecure-requests/, "");
      await route.fulfill({ response: res, headers: h });
    });
  }
  return ctx;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Polls an expression with page.evaluate; waitForFunction would need 'unsafe-eval', which the CSP rightly refuses. */
async function waitFor(page: Page, expr: string, timeout: number) {
  const end = Date.now() + timeout;
  while (!(await page.evaluate(expr))) { if (Date.now() > end) throw new Error(`timed out waiting for ${expr}`); await sleep(50); }
}

/** rAF deltas and draws during a walk (#next) or a 1 s drag, plus a 400 ms tail so the sharpen is counted. */
const MEASURE = `async (kind) => {
  const view = document.getElementById('view');
  const full = Math.max(2, Math.round(view.clientWidth * Math.min(devicePixelRatio || 1, 2)));
  const e0 = window.__m.ev.length, deltas = []; let last = 0, stop = false;
  const loop = (t) => { if (last) deltas.push(t - last); last = t; if (!stop) window.__mRaf(loop); };
  window.__mRaf(loop);
  const t0 = performance.now();
  if (kind === 'walk') {
    document.getElementById('next').click();
    const target = document.querySelector('.spot[data-go="ps5"]');
    await new Promise((res) => { const p = () => (target.hidden || performance.now() - t0 > 10000 ? res() : window.__mRaf(p)); window.__mRaf(p); });
  } else {
    const r = view.getBoundingClientRect(), x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const o = (x, y) => ({ clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true });
    document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown', o(x0, y0)));
    await new Promise((res) => { const s = performance.now(); const step = (t) => { const k = Math.min(1, (t - s) / 1000);
      window.dispatchEvent(new PointerEvent('pointermove', o(x0 - 200 * Math.sin(k * Math.PI), y0 + 40 * k))); if (k < 1) window.__mRaf(step); else res(); }; window.__mRaf(step); });
    window.dispatchEvent(new PointerEvent('pointerup', o(x0, y0)));
  }
  const dur = performance.now() - t0;
  await new Promise((r) => setTimeout(r, 400)); stop = true;
  const draws = window.__m.ev.slice(e0).filter((e) => e.k === 'draw');
  const s = [...deltas].sort((a, b) => a - b), q = (p) => s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
  return { dur: Math.round(dur), median: +q(.5).toFixed(1), p95: +q(.95).toFixed(1), low: draws.filter((d) => d.w < full).length, full: draws.filter((d) => d.w >= full).length };
}`;

/** App rAF callbacks and draws over 1 s with nothing happening. */
const IDLE = `async () => {
  const r0 = window.__m.raf, d0 = window.__m.ev.filter((e) => e.k === 'draw').length;
  await new Promise((r) => setTimeout(r, 1000));
  return { raf: window.__m.raf - r0, draws: window.__m.ev.filter((e) => e.k === 'draw').length - d0 };
}`;

/** Press and release on bare canvas without moving; longest backing reallocation not followed by a draw. */
const TAP = `async () => {
  const view = document.getElementById('view'), r = view.getBoundingClientRect();
  let x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < 40 && document.elementFromPoint(x, y)?.id !== 'gl'; i++) { x = r.left + 20 + (i * 37) % (r.width - 40); y = r.top + 40 + (i * 53) % (r.height - 80); }
  const o = { clientX: x, clientY: y, bubbles: true, pointerId: 2, pointerType: 'touch', isPrimary: true };
  const e0 = window.__m.ev.length, t0 = performance.now();
  document.elementFromPoint(x, y).dispatchEvent(new PointerEvent('pointerdown', o));
  await new Promise((res) => window.__mRaf(() => window.__mRaf(res)));
  window.dispatchEvent(new PointerEvent('pointerup', o));
  await new Promise((r) => setTimeout(r, 500));
  const end = performance.now(), ev = window.__m.ev.slice(e0);
  let blank = 0;
  ev.forEach((e, i) => { if (e.k !== 'resize') return; const d = ev.slice(i + 1).find((f) => f.k === 'draw'); blank = Math.max(blank, (d ? d.t : end) - e.t); });
  return { blank: Math.round(blank), resizes: ev.filter((e) => e.k === 'resize').length, draws: ev.filter((e) => e.k === 'draw').length, at: [Math.round(x), Math.round(y)], ms: Math.round(end - t0) };
}`;

const PRESS = `(down) => { const view = document.getElementById('view'), r = view.getBoundingClientRect();
  let x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < 40 && document.elementFromPoint(x, y)?.id !== 'gl'; i++) { x = r.left + 20 + (i * 37) % (r.width - 40); y = r.top + 40 + (i * 53) % (r.height - 80); }
  const o = { clientX: x, clientY: y, bubbles: true, pointerId: 3, pointerType: 'touch', isPrimary: true };
  if (down) document.elementFromPoint(x, y).dispatchEvent(new PointerEvent('pointerdown', o)); else window.dispatchEvent(new PointerEvent('pointerup', o)); }`;

/** Percent of pixels that are pure black: a reallocated, undrawn WebGL canvas shows as (0,0,0); the room never does in day mode. */
async function blackPercent(png: Buffer) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, all = 0;
  for (let k = 0; k < data.length; k += info.channels) { all++; if (data[k] === 0 && data[k + 1] === 0 && data[k + 2] === 0) n++; }
  return +(100 * n / all).toFixed(1);
}

interface Row {
  device: string; vp: string; firstFrame: number; afterDcl: number; ffSource: string;
  walk: { dur: number; median: number; p95: number; low: number; full: number };
  drag: { dur: number; median: number; p95: number; low: number; full: number };
  idle: { raf: number; draws: number }; tap: { blank: number; resizes: number; draws: number }; heldBlack: number;
  scroll: boolean; errors: string[]; bytes: Record<string, number>; restore: string;
}

/** Loses and restores the WebGL context (as iOS does in the background) and checks the room is drawn again. */
async function contextRestore(page: Page): Promise<string> {
  const ok = await page.evaluate(`(async () => {
    const ext = document.getElementById('gl').getContext('webgl').getExtension('WEBGL_lose_context');
    if (!ext) return 'no ext';
    ext.loseContext(); await new Promise((r) => setTimeout(r, 300));
    const n = window.__m.ev.length; ext.restoreContext(); await new Promise((r) => setTimeout(r, 600));
    return window.__m.ev.slice(n).some((e) => e.k === 'draw') ? 'drawn' : 'not drawn';
  })()`) as string;
  if (ok !== "drawn") return ok;
  return `drawn, ${await blackPercent(await page.locator("#gl").screenshot())}% black`;
}

function kindOf(url: string, type: string): string {
  if (type === "document") return "doc";
  if (type === "script" || /\.m?js(\?|$)/.test(url)) return "js";
  if (type === "stylesheet" || /\.css(\?|$)/.test(url)) return "css";
  if (type === "font" || /\.(woff2?|ttf|otf)(\?|$)/.test(url)) return "font";
  if (type === "image" || /\.(png|jpe?g|webp|avif|svg|ico)(\?|$)/.test(url)) return "img";
  return "other";
}

async function measureDevice(browser: Browser, name: string): Promise<Row> {
  const { defaultBrowserType: _b, ...desc } = devices[name]; void _b;
  const ctx = await newContext(browser, desc);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  const responses: Promise<[string, number]>[] = [];
  page.on("requestfinished", (req) => { responses.push(req.sizes().then((s) => [kindOf(req.url(), req.resourceType()), s.responseBodySize + s.responseHeadersSize] as [string, number]).catch(() => ["other", 0] as [string, number])); });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await waitFor(page, "window.__m.ev.some((e) => e.k === 'draw')", 15000);
  await sleep(1500);
  const bytes: Record<string, number> = { doc: 0, js: 0, css: 0, font: 0, img: 0, other: 0 };
  for (const [k, n] of await Promise.all(responses)) bytes[k] += n;
  bytes.total = Object.values(bytes).reduce((a, b) => a + b, 0);
  const ff = await page.evaluate(`(() => { const nav = performance.getEntriesByType('navigation')[0];
    const hook = window.__m.ev.find((e) => e.k === 'draw').t, app = window.__bisaatFirstFrame;
    const t = typeof app === 'number' ? app : hook;
    return { t: Math.round(t), dcl: Math.round(t - nav.domContentLoadedEventEnd), src: typeof app === 'number' ? 'app' : 'hook' }; })()`) as { t: number; dcl: number; src: string };
  const scroll = await page.evaluate("(() => { const se = document.scrollingElement; return se.scrollHeight > innerHeight || se.scrollWidth > innerWidth; })()") as boolean;
  const idle = await page.evaluate(`(${IDLE})()`) as Row["idle"];
  const tap = await page.evaluate(`(${TAP})()`) as Row["tap"];
  await page.evaluate(`(${PRESS})(true)`); await sleep(300);
  const heldBlack = await blackPercent(await page.locator("#view").screenshot());
  await page.evaluate(`(${PRESS})(false)`); await sleep(400);
  const drag = await page.evaluate(`(${MEASURE})('drag')`) as Row["walk"];
  const walk = await page.evaluate(`(${MEASURE})('walk')`) as Row["walk"];
  const restore = await contextRestore(page);
  const csp = await page.evaluate("window.__m.csp") as string[];
  await ctx.close();
  const v = desc.viewport as { width: number; height: number };
  return { device: name, vp: `${v.width}x${v.height}@${desc.deviceScaleFactor}`, firstFrame: ff.t, afterDcl: ff.dcl, ffSource: ff.src, walk, drag, idle, tap, heldBlack, scroll, restore, errors: [...errors, ...csp.map((c) => "csp: " + c)], bytes };
}

const CAPTURES: { name: string; path: string; vp: { width: number; height: number }; dpr: number; mobile: boolean; scheme: "light" | "dark" }[] = [
  ...["door", "lib", "lib-night"].map((h) => ({ name: `390-${h}`, path: "/#" + h, vp: { width: 390, height: 844 }, dpr: 3, mobile: true, scheme: "light" as const })),
  { name: "390-door-dark", path: "/", vp: { width: 390, height: 844 }, dpr: 3, mobile: true, scheme: "dark" },
  { name: "390x2-door", path: "/", vp: { width: 390, height: 844 }, dpr: 2, mobile: false, scheme: "light" },
  { name: "1280-door", path: "/", vp: { width: 1280, height: 800 }, dpr: 1, mobile: false, scheme: "light" },
  { name: "1280-lib-night", path: "/#lib-night", vp: { width: 1280, height: 800 }, dpr: 1, mobile: false, scheme: "light" },
  { name: "se-land-door", path: "/", vp: { width: 568, height: 320 }, dpr: 2, mobile: true, scheme: "light" },
];

async function capture(browser: Browser, dir: string) {
  mkdirSync(dir, { recursive: true });
  for (const c of CAPTURES) {
    const ctx = await newContext(browser, { viewport: c.vp, deviceScaleFactor: c.dpr, isMobile: c.mobile, hasTouch: c.mobile }, { colorScheme: c.scheme });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(FROZEN);
    await page.goto(BASE + c.path, { waitUntil: "load" });
    await waitFor(page, "window.__m.ev.some((e) => e.k === 'draw')", 15000);
    await sleep(2000);
    await page.evaluate("window.__m.cap = true; window.dispatchEvent(new Event('resize'))");
    await waitFor(page, "window.__m.capData !== null", 5000);
    const px = await page.evaluate("(() => { const d = window.__m.capData; let s = ''; for (let i = 0; i < d.px.length; i += 32768) s += String.fromCharCode.apply(null, d.px.subarray(i, i + 32768)); return { w: d.w, h: d.h, b64: btoa(s) }; })()") as { w: number; h: number; b64: string };
    const raw = Buffer.from(px.b64, "base64");
    await sharp(raw, { raw: { width: px.w, height: px.h, channels: 4 } }).flip().png().toFile(path.join(dir, `${c.name}.canvas.png`));
    await sleep(300);
    await page.screenshot({ path: path.join(dir, `${c.name}.page.png`) });
    const dom = await page.evaluate("(() => [...document.querySelectorAll('.spot')].map((s) => s.dataset.go + ':' + s.hidden + ':' + s.className + ':' + s.style.transform).join('|') + ' title=' + document.getElementById('title').textContent + ' mode=' + document.documentElement.dataset.mode + ' gl=' + document.getElementById('gl').width + 'x' + document.getElementById('gl').height)()") as string;
    writeFileSync(path.join(dir, `${c.name}.dom.txt`), dom + "\n");
    console.log(`captured ${c.name}: canvas ${px.w}x${px.h}`);
    await ctx.close();
  }
}

async function diff(a: string, b: string) {
  let bad = 0;
  for (const f of readdirSync(a).filter((x) => x.endsWith(".png")).sort()) {
    const [ra, rb] = await Promise.all([a, b].map((d) => sharp(path.join(d, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
    if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) { console.log(`${f}: size ${ra.info.width}x${ra.info.height} vs ${rb.info.width}x${rb.info.height}`); bad++; continue; }
    let n = 0, minY = Infinity, maxY = -1; const w = ra.info.width;
    for (let i = 0; i < ra.data.length; i += 4) {
      if (ra.data[i] !== rb.data[i] || ra.data[i + 1] !== rb.data[i + 1] || ra.data[i + 2] !== rb.data[i + 2] || ra.data[i + 3] !== rb.data[i + 3]) { n++; const y = Math.floor(i / 4 / w); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    if (n) bad++;
    console.log(`${f}: ${n} px differ of ${w * ra.info.height}${n ? ` (rows ${minY}-${maxY})` : ""}`);
  }
  for (const f of readdirSync(a).filter((x) => x.endsWith(".dom.txt")).sort()) {
    const same = readFileSync(path.join(a, f), "utf8") === readFileSync(path.join(b, f), "utf8");
    if (!same) bad++;
    console.log(`${f}: ${same ? "same" : "DIFFERENT"}`);
  }
  console.log(bad ? `${bad} files differ` : "all identical");
}

/** Compressed homepage HTML size fetched directly, as Safari asks for it (the browser figure is unreliable under --strip-uir's route). */
function documentBytes(): Promise<{ bytes: number; encoding: string }> {
  return new Promise((resolve, reject) => {
    get(BASE + "/", { headers: { "accept-encoding": "gzip, deflate, br" } }, (res) => {
      let n = 0; res.on("data", (c: Buffer) => { n += c.length; }); res.on("end", () => resolve({ bytes: n, encoding: String(res.headers["content-encoding"] ?? "identity") }));
    }).on("error", reject);
  });
}

const kb = (n: number) => (n / 1024).toFixed(1);

(async () => {
  const d = opt("--diff");
  if (d) return diff(d, argv[argv.indexOf("--diff") + 2]);
  const browser = await webkit.launch();
  console.log(`WebKit ${browser.version()} against ${BASE}${STRIP_UIR ? " (upgrade-insecure-requests stripped)" : ""}`);
  const cap = opt("--capture");
  if (cap) { await capture(browser, cap); await browser.close(); return; }
  const doc = await documentBytes();
  if (flag("--modes-only")) { const m = await modeCheck(browser); await browser.close(); m.forEach((l) => console.log(l)); return; }
  const rows: Row[] = [];
  for (const name of DEVICES) { rows.push(await measureDevice(browser, name)); console.error(`measured ${name}`); }
  const modes = await modeCheck(browser);
  await browser.close();
  console.log("\n| Device | Viewport | First frame ms (after DCL) | Walk median / p95 ms | Walk draws low/full | Drag median / p95 ms | Drag draws low/full | Idle rAF/s, draws/s | Tap blank ms | Held-press black % | Doc scrolls | GL lose/restore | Errors |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.device} | ${r.vp} | ${r.firstFrame} (${r.afterDcl}) | ${r.walk.median} / ${r.walk.p95} | ${r.walk.low}/${r.walk.full} | ${r.drag.median} / ${r.drag.p95} | ${r.drag.low}/${r.drag.full} | ${r.idle.raf}, ${r.idle.draws} | ${r.tap.blank} | ${r.heldBlack} | ${r.scroll ? "YES" : "no"} | ${r.restore} | ${r.errors.length} |`);
  console.log("\n| Device | Doc KB | JS KB | CSS KB | Font KB | Image KB | Other KB | Total KB |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.device} | ${kb(r.bytes.doc)} | ${kb(r.bytes.js)} | ${kb(r.bytes.css)} | ${kb(r.bytes.font)} | ${kb(r.bytes.img)} | ${kb(r.bytes.other)} | ${kb(r.bytes.total)} |`);
  console.log("\nDark mode before first paint (iPhone 15 Pro). Settle = ms from navigation start to the sheet's final colour (the first frame's time when it never changes).");
  console.log("| Case | Want | First painted sheet | Settle ms | Colour changes | Early screenshot sheet | CSP violations | Result |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const m of modes) console.log(m);
  console.log(`\nhomepage HTML fetched directly: ${kb(doc.bytes)} KB body (${doc.encoding})`);
  console.log(`first-frame source: ${[...new Set(rows.map((r) => r.ffSource))].join(", ")} (app = window.__bisaatFirstFrame, hook = first drawArrays)`);
  for (const r of rows) if (r.errors.length) console.log(`${r.device} errors: ${r.errors.join(" ; ")}`);
  const j = opt("--json"); if (j) writeFileSync(j, JSON.stringify(rows, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
