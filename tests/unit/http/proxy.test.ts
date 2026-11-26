import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createProxy, config } from "@/proxy";
import { createRateLimiter } from "@/server/http/rate-limit";
import { buildCsp, SECURITY_HEADERS } from "@/server/http/security-headers";

function make(limit = 60) {
  return createProxy({
    limiter: createRateLimiter({ limit, windowMs: 60_000 }),
    isDev: false,
  });
}
function req(path: string, method = "GET", ip?: string, origin = "http://localhost:3000", extra: Record<string, string> = {}) {
  return new NextRequest(`${origin}${path}`, {
    method,
    headers: { ...(ip ? { "x-forwarded-for": ip } : {}), ...extra },
  });
}
const isPassThrough = (r: Response) =>
  r.headers.get("x-middleware-next") === "1";

describe("proxy deny rules", () => {
  it.each([
    ["GET", "/admin"],
    ["GET", "/admin/x"],
    ["POST", "/admin"],
    ["GET", "/ADMIN"],
    ["GET", "/Admin/"],
    ["GET", "/admin/"],
    ["GET", "//admin"],
    ["GET", "/%61dmin"],
    ["GET", "/%2561dmin"],
    ["GET", "/admin%2f"],
    ["GET", "/admin;x"],
    ["GET", "/admin."],
    ["GET", "/admin%2e"],
    ["GET", "/x/%2e%2e/admin"],
  ])("%s %s -> 403", async (m, p) => {
    const res = await make()(req(p, m));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("Forbidden");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("undecodable path -> 400", () => {
    expect(make()(req("/%E0%A4%A")).status).toBe(400);
  });

  it("encoded and doubled api path is still treated as api", () => {
    expect(make()(req("//%61pi/content", "POST")).status).toBe(405);
  });

  it("OPTIONS /api/content -> 405", () => {
    expect(make()(req("/api/content", "OPTIONS")).status).toBe(405);
  });

  it("/administrator is not denied", () => {
    expect(make()(req("/administrator")).status).not.toBe(403);
  });

  it.each(["POST", "PUT", "DELETE", "PATCH"])("%s /api/content -> 405", (m) => {
    const res = make()(req("/api/content", m));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
  });

  it("allows HEAD on api", () => {
    expect(isPassThrough(make()(req("/api/content", "HEAD")))).toBe(true);
  });
});

describe("proxy rate limit", () => {
  it("429s the 61st api request from one IP, not another IP", () => {
    const p = make(60);
    for (let i = 0; i < 60; i++) {
      expect(p(req("/api/content", "GET", "1.1.1.1")).status).toBe(200);
    }
    const res = p(req("/api/content", "GET", "1.1.1.1"));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(isPassThrough(p(req("/api/content", "GET", "2.2.2.2")))).toBe(true);
  });

  it("keys on the rightmost x-forwarded-for entry", () => {
    const p = make(1);
    p(req("/api/content", "GET", "9.9.9.9, 3.3.3.3"));
    expect(p(req("/api/content", "GET", "8.8.8.8, 3.3.3.3")).status).toBe(429);
  });

  it("rotating leftmost XFF with fixed rightmost still hits 429", () => {
    const p = make(2);
    p(req("/api/content", "GET", "1.1.1.1, 7.7.7.7"));
    p(req("/api/content", "GET", "2.2.2.2, 7.7.7.7"));
    expect(p(req("/api/content", "GET", "3.3.3.3, 7.7.7.7")).status).toBe(429);
  });

  it("never limits pages", () => {
    const p = make(1);
    for (let i = 0; i < 100; i++) {
      expect(p(req("/", "GET", "4.4.4.4")).status).not.toBe(429);
    }
  });
});

describe("proxy headers", () => {
  it("page response carries CSP and security headers", () => {
    const res = make()(req("/"));
    const csp = res.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("nonce-");
    expect(csp).not.toContain("fonts.googleapis.com");
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(k)).toBe(v);
    }
  });

  it("forwards nonce and CSP as request headers", () => {
    const res = make()(req("/"));
    const csp = res.headers.get("Content-Security-Policy")!;
    const fwd = res.headers.get("x-middleware-override-headers") ?? "";
    expect(fwd).toContain("x-nonce");
    const nonce = res.headers.get("x-middleware-request-x-nonce")!;
    expect(nonce.length).toBeGreaterThan(10);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(res.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });

  it("sends upgrade-insecure-requests only when the request arrived over HTTPS", () => {
    const csp = (r: NextRequest) => make()(r).headers.get("Content-Security-Policy")!;
    expect(csp(req("/"))).not.toContain("upgrade-insecure-requests");
    expect(csp(req("/", "GET", undefined, "http://192.168.1.20:3000"))).not.toContain("upgrade-insecure-requests");
    expect(csp(req("/", "GET", undefined, "https://bisaat.club"))).toContain("upgrade-insecure-requests");
    expect(csp(req("/", "GET", undefined, "http://localhost:3000", { "x-forwarded-proto": "https" }))).toContain("upgrade-insecure-requests");
    expect(csp(req("/", "GET", undefined, "http://localhost:3000", { "x-forwarded-proto": "https,http" }))).toContain("upgrade-insecure-requests");
    expect(csp(req("/", "GET", undefined, "http://localhost:3000", { "x-forwarded-proto": "http" }))).not.toContain("upgrade-insecure-requests");
  });

  it("nonce differs per request", () => {
    const p = make();
    expect(p(req("/")).headers.get("x-middleware-request-x-nonce")).not.toBe(
      p(req("/")).headers.get("x-middleware-request-x-nonce"),
    );
  });
});

describe("buildCsp", () => {
  it("prod over HTTPS", () => {
    const c = buildCsp("N", { isDev: false, https: true });
    expect(c).toBe(
      "default-src 'self'; script-src 'self' 'nonce-N' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests",
    );
  });
  it("prod over plain HTTP (localhost, LAN) leaves out upgrade-insecure-requests", () => {
    // Safari applies it even to http://localhost and LAN addresses, rewriting every asset to https.
    expect(buildCsp("N", { isDev: false, https: false })).toBe(
      "default-src 'self'; script-src 'self' 'nonce-N' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
  });
  it("dev", () => {
    const c = buildCsp("N", { isDev: true, https: true });
    expect(c).toContain("'unsafe-eval'");
    expect(c).toContain("connect-src 'self' ws:");
    expect(c).not.toContain("upgrade-insecure-requests");
  });
});

describe("config", () => {
  it("has a matcher", () => {
    expect(config.matcher.length).toBeGreaterThan(0);
  });
});
