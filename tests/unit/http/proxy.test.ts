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
function req(path: string, method = "GET", ip?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: ip ? { "x-forwarded-for": ip } : {},
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
  ])("%s %s -> 403", async (m, p) => {
    const res = await make()(req(p, m));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("Forbidden");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
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

  it("uses first x-forwarded-for entry", () => {
    const p = make(1);
    p(req("/api/content", "GET", "3.3.3.3, 9.9.9.9"));
    expect(p(req("/api/content", "GET", "3.3.3.3, 8.8.8.8")).status).toBe(429);
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

  it("nonce differs per request", () => {
    const p = make();
    expect(p(req("/")).headers.get("x-middleware-request-x-nonce")).not.toBe(
      p(req("/")).headers.get("x-middleware-request-x-nonce"),
    );
  });
});

describe("buildCsp", () => {
  it("prod", () => {
    const c = buildCsp("N", false);
    expect(c).toBe(
      "default-src 'self'; script-src 'self' 'nonce-N' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests",
    );
  });
  it("dev", () => {
    const c = buildCsp("N", true);
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
