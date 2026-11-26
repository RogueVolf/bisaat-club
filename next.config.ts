import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // /brand/* files are not content-hashed, so one day rather than immutable
    return [{ source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] }];
  },
};

export default nextConfig;
