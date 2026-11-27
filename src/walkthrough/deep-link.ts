export interface DeepLink { zone: string | null; mode: "night" | "day" | null }

/**
 * Reference deep links: `#lib` opens at the reading room, `#lib-night` opens it in dark mode.
 * Split on `-`; `night` anywhere wins over `day` anywhere; the zone is the first part only,
 * if it is a known id other than `door`.
 */
export function parseDeepLink(hash: string, zoneIds: string[]): DeepLink {
  const parts = (hash || "").slice(1).split("-"), h = parts[0];
  const mode = parts.indexOf("night") >= 0 ? "night" : parts.indexOf("day") >= 0 ? "day" : null;
  const zone = zoneIds.includes(h) && h !== "door" ? h : null;
  return { zone, mode };
}

/**
 * Inline <head> script (layout.tsx) that sets `html[data-mode]` before first paint, with the same rules
 * the controller applies at start: a `#...-night` / `#...-day` link (as in parseDeepLink), else the
 * prefers-color-scheme. Without it a dark-mode phone painted the cream sheet, then faded to ink.
 * Kept in sync with parseDeepLink by tests/unit/walkthrough/deep-link.test.ts, which runs both on the same cases.
 */
export const MODE_BOOT_SCRIPT =
  "try{var p=(location.hash||'').slice(1).split('-');" +
  "document.documentElement.dataset.mode=p.indexOf('night')>=0?'night':p.indexOf('day')>=0?'day':" +
  "window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'night':'day'}catch(e){}";
