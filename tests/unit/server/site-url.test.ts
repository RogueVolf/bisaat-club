import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let reqHeaders: Record<string, string> | null = {};
vi.mock("next/headers", () => ({
  headers: async () => {
    if (reqHeaders === null) throw new Error("outside a request scope");
    return new Headers(reqHeaders);
  },
}));

import { resetSiteUrlWarning, siteUrl } from "@/server/site-url";

const HOST_MSG = "SITE_URL is not set or invalid; using the request host for Open Graph and structured data";
const LOCAL_MSG = "SITE_URL is not set or invalid and no valid request host; Open Graph and structured data will point at localhost";

describe("siteUrl", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetSiteUrlWarning();
    reqHeaders = {};
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.SITE_URL;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  it("uses a valid SITE_URL over the request", async () => {
    vi.stubEnv("SITE_URL", " https://bisaat.club ");
    reqHeaders = { host: "other.example" };
    expect((await siteUrl()).origin).toBe("https://bisaat.club");
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "   "],
    ["invalid", "not a url"],
  ])("falls back to the request host when SITE_URL is %s", async (_n, v) => {
    if (v !== undefined) vi.stubEnv("SITE_URL", v);
    reqHeaders = { host: "club.example:8080" };
    expect((await siteUrl()).origin).toBe("http://club.example:8080");
  });

  it("on a Vercel production deployment uses the project's production domain before the request host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "bisaat.club");
    reqHeaders = { host: "bisaat-club-abc123.vercel.app" };
    expect((await siteUrl()).origin).toBe("https://bisaat.club");
    expect(warn).not.toHaveBeenCalled();
  });

  it("on a Vercel preview deployment uses the request host, not the production domain", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "bisaat.club");
    reqHeaders = { host: "bisaat-club-git-x.vercel.app", "x-forwarded-proto": "https" };
    expect((await siteUrl()).origin).toBe("https://bisaat-club-git-x.vercel.app");
  });

  it("ignores an invalid VERCEL_PROJECT_PRODUCTION_URL", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "evil.com/path");
    reqHeaders = { host: "bisaat.club" };
    expect((await siteUrl()).origin).toBe("http://bisaat.club");
  });

  it("prefers x-forwarded-host and x-forwarded-proto over host", async () => {
    reqHeaders = { host: "internal:3000", "x-forwarded-host": "bisaat.club", "x-forwarded-proto": "https" };
    expect((await siteUrl()).origin).toBe("https://bisaat.club");
  });

  it("uses the rightmost forwarded entry", async () => {
    reqHeaders = { "x-forwarded-host": "evil.example, bisaat.club", "x-forwarded-proto": "http, https" };
    expect((await siteUrl()).origin).toBe("https://bisaat.club");
  });

  it("defaults the scheme to https in production and http otherwise", async () => {
    reqHeaders = { host: "bisaat.club" };
    expect((await siteUrl()).protocol).toBe("http:");
    vi.stubEnv("NODE_ENV", "production");
    expect((await siteUrl()).protocol).toBe("https:");
  });

  it("ignores an unknown x-forwarded-proto", async () => {
    reqHeaders = { host: "bisaat.club", "x-forwarded-proto": "javascript" };
    expect((await siteUrl()).protocol).toBe("http:");
  });

  it.each([
    "evil.com/path",
    "evil.com@bisaat.club",
    "user:pw@evil.com",
    "evil.com#x",
    "evil.com?x=1",
    "a b.com",
    "evil.com\r\nX-Injected: 1",
    "evil.com:99999999",
    "evil.com:",
    "-evil.com",
    "evil..com",
    "[::1]",
    "<script>.com",
    "",
  ])("rejects malicious host %j and uses localhost", async (host) => {
    reqHeaders = { host };
    expect((await siteUrl()).href).toBe("http://localhost:3000/");
  });

  it("rejects a malicious x-forwarded-host even when host is fine", async () => {
    reqHeaders = { host: "bisaat.club", "x-forwarded-host": "evil.com/x" };
    expect((await siteUrl()).href).toBe("http://localhost:3000/");
  });

  it("falls back to localhost outside a request scope", async () => {
    reqHeaders = null;
    expect((await siteUrl()).href).toBe("http://localhost:3000/");
  });

  it("does not warn outside production", async () => {
    reqHeaders = { host: "bisaat.club" };
    await siteUrl();
    reqHeaders = {};
    await siteUrl();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns once in production when using the request host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    reqHeaders = { host: "bisaat.club" };
    await siteUrl();
    vi.stubEnv("SITE_URL", "nope");
    await siteUrl();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(HOST_MSG);
  });

  it("warns once in production when falling all the way to localhost", async () => {
    vi.stubEnv("NODE_ENV", "production");
    reqHeaders = { host: "bad/host" };
    await siteUrl();
    await siteUrl();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(LOCAL_MSG);
  });

  it("does not warn in production when SITE_URL is valid", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "https://bisaat.club");
    await siteUrl();
    expect(warn).not.toHaveBeenCalled();
  });
});
