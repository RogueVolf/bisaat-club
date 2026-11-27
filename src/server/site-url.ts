import "server-only";
import { headers } from "next/headers";

const FALLBACK = "http://localhost:3000";
let warnedHost = false;
let warnedLocal = false;

// Hostname (dot-separated alphanumeric/hyphen labels, so IPv4 too) with an optional port. Nothing else:
// no userinfo, path, whitespace or brackets, so a hostile Host header cannot smuggle anything into the URL.
const HOST = /^(?=.{1,253}(?::\d{1,5})?$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*(?::\d{1,5})?$/;

/** Rightmost entry, matching how the proxy header is trusted elsewhere (one trusted proxy appends). */
const last = (v: string | null): string => (v ?? "").split(",").pop()?.trim() ?? "";

function requestOrigin(h: Headers): URL | null {
  const host = last(h.get("x-forwarded-host")) || (h.get("host") ?? "").trim();
  if (!HOST.test(host)) return null;
  const fwd = last(h.get("x-forwarded-proto")).toLowerCase();
  const proto = fwd === "http" || fwd === "https" ? fwd : process.env.NODE_ENV === "production" ? "https" : "http";
  try {
    return new URL(`${proto}://${host}`);
  } catch {
    return null;
  }
}

async function currentHeaders(): Promise<Headers | null> {
  try {
    return await headers();
  } catch {
    return null; // outside a request scope
  }
}

/**
 * Public site origin. SITE_URL when valid, then (on a Vercel production deployment) the project's production
 * domain, otherwise the request origin (x-forwarded-proto and
 * x-forwarded-host, or host, strictly validated), otherwise localhost.
 */
export async function siteUrl(): Promise<URL> {
  const raw = process.env.SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      // fall through
    }
  }
  // Vercel production deployments know their own primary domain; preview deployments keep their own host.
  const vercelHost = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() : "";
  if (vercelHost && HOST.test(vercelHost)) return new URL(`https://${vercelHost}`);
  const h = await currentHeaders();
  const origin = h ? requestOrigin(h) : null;
  const prod = process.env.NODE_ENV === "production";
  if (origin) {
    if (prod && !warnedHost) {
      warnedHost = true;
      console.warn("SITE_URL is not set or invalid; using the request host for Open Graph and structured data");
    }
    return origin;
  }
  if (prod && !warnedLocal) {
    warnedLocal = true;
    console.warn("SITE_URL is not set or invalid and no valid request host; Open Graph and structured data will point at localhost");
  }
  return new URL(FALLBACK);
}

/** Test hook: lets the once-per-process warnings fire again. */
export function resetSiteUrlWarning(): void {
  warnedHost = false;
  warnedLocal = false;
}
