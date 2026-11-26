import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter, type RateLimiter } from "@/server/http/rate-limit";
import { buildCsp, SECURITY_HEADERS } from "@/server/http/security-headers";

interface ProxyDeps {
  limiter: RateLimiter;
  isDev: boolean;
}

function withSecurityHeaders<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function createProxy({ limiter, isDev }: ProxyDeps) {
  return function handle(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl;
    const lower = pathname.toLowerCase();
    const method = request.method.toUpperCase();

    if (lower === "/admin" || lower.startsWith("/admin/")) {
      return withSecurityHeaders(
        new NextResponse("Forbidden", {
          status: 403,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
      );
    }

    const isApi = lower === "/api" || lower.startsWith("/api/");
    if (isApi) {
      if (method !== "GET" && method !== "HEAD") {
        return withSecurityHeaders(
          new NextResponse("Method Not Allowed", {
            status: 405,
            headers: { Allow: "GET, HEAD" },
          }),
        );
      }
      const result = limiter.hit(clientIp(request));
      if (!result.ok) {
        return withSecurityHeaders(
          new NextResponse("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": String(result.retryAfterS) },
          }),
        );
      }
    }

    const nonce = newNonce();
    const csp = buildCsp(nonce, isDev);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return withSecurityHeaders(res);
  };
}

const parsedLimit = Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? "", 10);
const limiter = createRateLimiter({
  limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 60,
  windowMs: 60_000,
});

export const proxy = createProxy({
  limiter,
  isDev: process.env.NODE_ENV !== "production",
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/).*)",
  ],
};
