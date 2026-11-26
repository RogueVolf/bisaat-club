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
