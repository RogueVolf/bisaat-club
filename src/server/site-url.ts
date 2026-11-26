import "server-only";

const FALLBACK = "http://localhost:3000";
let warned = false;

/** Public site origin from SITE_URL. Empty, whitespace or invalid values fall back to localhost. */
export function siteUrl(): URL {
  const raw = process.env.SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      // fall through to the fallback
    }
  }
  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn("SITE_URL is not set; Open Graph and structured data will point at localhost");
  }
  return new URL(FALLBACK);
}

/** Test hook: lets the once-per-process warning fire again. */
export function resetSiteUrlWarning(): void {
  warned = false;
}
