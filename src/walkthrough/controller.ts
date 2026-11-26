import type { SiteContent, Zone } from "@/content/schema";
import type { CameraState, RoomRenderer } from "@/scene/types";
import { parseDeepLink } from "./deep-link";
import { placeHotspots } from "./hotspots";
import { EYE } from "./math";

type Vec3 = [number, number, number];
interface Walk { t0: number; dur: number; x0: number; z0: number; y0: number; p0: number; x1: number; z1: number; dy: number; p1: number; ly: number; lp: number; steps: number }

function ease(t: number) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/**
 * Drives the walk-through on the server-rendered stage markup: light/dark mode, camera walks
 * between zones, drag to look, the sheet copy, hotspots and the render-on-dirty frame loop.
 * Ported from the reference page script. Returns a cleanup that undoes everything it set up.
 */
export function startWalkthrough(root: HTMLElement, content: SiteContent, renderer: RoomRenderer): () => void {
  const el = <T extends Element = HTMLElement>(id: string): T => {
    const e = root.querySelector<T>('#' + id);
    if (!e) throw new Error(`walkthrough: #${id} missing`);
    return e;
  };
  const view = el('view'), canvas = el<HTMLCanvasElement>('gl'), hint = el('hint');
  const kicker = el('kicker'), title = el('title'), body = el('body'), price = el('price');
  const brand = el<HTMLImageElement>('brand'), modeBtn = el('mode'), nextBtn = el('next'), nogl = el('nogl');
  const html = document.documentElement;

  const zones = content.zones;
  const ZONES = new Map<string, Zone>(zones.map((z) => [z.id, z]));
  const ORDER = zones.map((z) => z.id);
  const start = zones[0];

  const listeners: [EventTarget, string, EventListener][] = [];
  const on = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) => {
    target.addEventListener(type, fn as EventListener); listeners.push([target, type, fn as EventListener]);
  };

  let dirty = true;

  /* ---------- WebGL setup ---------- */
  const ok = renderer.init(canvas, { logoUrl: brand.src, onNeedsRender: () => { dirty = true; } });
  if (!ok) { nogl.style.display = 'flex'; hint.style.display = 'none'; }

  /* ---------- Light and dark mode ---------- */
  let day = 1, dayTarget = 1;
  function setMode(night: boolean, instant?: boolean) { html.dataset.mode = night ? 'night' : 'day'; dayTarget = night ? 0 : 1; if (instant) day = dayTarget; dirty = true; }
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  setMode(!!(mq && mq.matches), true);
  if (mq && typeof mq.addEventListener === 'function') on<MediaQueryListEvent>(mq, 'change', function (e) { setMode(e.matches); });
  on(modeBtn, 'click', function () { setMode(html.dataset.mode !== 'night'); });

  /* ---------- Camera ---------- */
  const cam = { x: start.cam[0], z: start.cam[1], yaw: start.yaw, pitch: start.pitch, bob: 0 };
  const look = { yaw: 0, pitch: 0 };
  let walk: Walk | null = null, at = start.id, W = 1, H = 1, sharpAt = 0, lowRes = false;
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const camera = (): CameraState => ({ x: cam.x, z: cam.z, eyeY: EYE + cam.bob, yaw: cam.yaw + look.yaw, pitch: cam.pitch + look.pitch });
  /* Render at reduced resolution while moving, then sharpen once still: keeps iPhones smooth */
  function sizeCanvas(low: boolean) { const dpr = Math.min(window.devicePixelRatio || 1, 2) * (low ? .55 : 1); W = view.clientWidth; H = view.clientHeight; renderer.resize(W, H, dpr); lowRes = low; }
  on(window, 'resize', function () { sizeCanvas(false); dirty = true; });
  let ro: ResizeObserver | null = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(function () { sizeCanvas(lowRes); dirty = true; }); ro.observe(view); }
  sizeCanvas(false);

  /* ---------- Walking ---------- */
  const spots = Array.from(root.querySelectorAll<HTMLButtonElement>('.spot'));
  const placeable = spots.flatMap((s) => { const z = ZONES.get(s.dataset.go ?? ''); return z && z.at ? [{ el: s, id: z.id, at: z.at as Vec3 }] : []; });
  function fill(id: string) { const z = ZONES.get(id)!; kicker.textContent = z.kicker; title.textContent = z.title; body.textContent = z.body; price.textContent = z.price; }
  function go(id: string) {
    const z = ZONES.get(id);
    if (!z) return;
    if (id === at && !walk) return;
    const dy = ((z.yaw - cam.yaw + 540) % 360) - 180, d = Math.hypot(z.cam[0] - cam.x, z.cam[1] - cam.z);
    walk = { t0: performance.now(), dur: reduce ? 1 : Math.max(1500, d * 560), x0: cam.x, z0: cam.z, y0: cam.yaw, p0: cam.pitch, x1: z.cam[0], z1: z.cam[1], dy: dy, p1: z.pitch, ly: look.yaw, lp: look.pitch, steps: Math.max(2, Math.round(d / .7)) };
    at = id; fill(id); dirty = true; hint.style.opacity = '0';
  }
  spots.forEach(function (s) { on(s, 'click', function () { go(s.dataset.go ?? ''); }); });
  on(nextBtn, 'click', function () { go(ORDER[(ORDER.indexOf(at) + 1) % ORDER.length]); });
  fill(start.id);
  /* Deep links: #lib opens at the reading room, #lib-night opens it in dark mode */
  {
    const link = parseDeepLink(location.hash || '', ORDER);
    if (link.mode === 'night') setMode(true, true); else if (link.mode === 'day') setMode(false, true);
    if (link.zone) { const z = ZONES.get(link.zone)!; cam.x = z.cam[0]; cam.z = z.cam[1]; cam.yaw = z.yaw; cam.pitch = z.pitch; at = z.id; fill(z.id); hint.style.display = 'none'; }
  }

  /* ---------- Looking around ---------- */
  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  on<PointerEvent>(view, 'pointerdown', function (e) { if (e.target instanceof Element && e.target.closest('.spot')) return; drag = { x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch }; });
  on<PointerEvent>(window, 'pointermove', function (e) { if (!drag || walk) return; look.yaw = Math.max(-80, Math.min(80, drag.yaw - (e.clientX - drag.x) * .22)); look.pitch = Math.max(-22, Math.min(22, drag.pitch + (e.clientY - drag.y) * .16)); dirty = true; hint.style.opacity = '0'; });
  on(window, 'pointerup', function () { drag = null; }); on(window, 'pointercancel', function () { drag = null; });

  /* ---------- Frame loop (renders only when something changed) ---------- */
  let raf = 0;
  function frame(now: number) {
    const moving = !!walk || !!drag || day !== dayTarget;
    if (walk) { const t = Math.min(1, (now - walk.t0) / walk.dur), k = ease(t);
      cam.x = walk.x0 + (walk.x1 - walk.x0) * k; cam.z = walk.z0 + (walk.z1 - walk.z0) * k; cam.yaw = walk.y0 + walk.dy * k; cam.pitch = walk.p0 + (walk.p1 - walk.p0) * k;
      look.yaw = walk.ly * (1 - k); look.pitch = walk.lp * (1 - k); cam.bob = reduce ? 0 : Math.sin(k * Math.PI * walk.steps) * .02 * Math.sin(t * Math.PI);
      if (t >= 1) { walk = null; cam.bob = 0; } dirty = true; }
    if (day !== dayTarget) { day += Math.sign(dayTarget - day) * Math.min(Math.abs(dayTarget - day), reduce ? 1 : .035); dirty = true; }
    if (moving) { sharpAt = now + 140; if (!lowRes) { sizeCanvas(true); } }
    else if (lowRes && now > sharpAt) { sizeCanvas(false); dirty = true; }
    if (dirty && ok) { dirty = false;
      renderer.render(camera(), day);
      const placed = placeHotspots({ spots: placeable.map((s) => ({ id: s.id, at: s.at })), current: at, walking: !!walk, W, H, camX: cam.x, camZ: cam.z, yawNow: cam.yaw + look.yaw, project: (p) => renderer.project(p) });
      placed.forEach(function (p, i) { const s = placeable[i].el;
        if (p.hidden) { s.hidden = true; return; }
        s.hidden = false;
        if (!p.pinned) { s.classList.remove('r'); s.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)'; }
        else if (p.side === 'l') { s.classList.remove('r'); s.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; }
        else { s.classList.add('r'); s.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) translateX(-100%)'; } }); }
    raf = requestAnimationFrame(frame);
  }
  if (!ok) spots.forEach(function (s) { s.hidden = true; });
  raf = requestAnimationFrame(frame);

  return function cleanup() {
    cancelAnimationFrame(raf);
    listeners.forEach(([t, type, fn]) => t.removeEventListener(type, fn));
    listeners.length = 0;
    if (ro) ro.disconnect();
    renderer.dispose();
  };
}
