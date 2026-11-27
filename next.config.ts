import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/server/http/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // The proxy (src/proxy.ts) skips static assets, so the static headers are also set here for every
      // path. The proxy still adds the per-request CSP, which does not belong in this static config.
      { source: "/:path*", headers: Object.entries(SECURITY_HEADERS).map(([key, value]) => ({ key, value })) },
      // /brand/* files are not content-hashed, so one day rather than immutable
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
    ];
  },
};

export default nextConfig;
