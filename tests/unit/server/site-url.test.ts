import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSiteUrlWarning, siteUrl } from "@/server/site-url";

const MSG = "SITE_URL is not set; Open Graph and structured data will point at localhost";

describe("siteUrl", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetSiteUrlWarning();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "   "],
    ["invalid", "not a url"],
  ])("falls back to localhost when %s", (_n, v) => {
    vi.stubEnv("NODE_ENV", "test");
    if (v === undefined) delete process.env.SITE_URL;
    else vi.stubEnv("SITE_URL", v);
    expect(siteUrl().href).toBe("http://localhost:3000/");
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses a valid value", () => {
    vi.stubEnv("SITE_URL", " https://bisaat.club ");
    expect(siteUrl().origin).toBe("https://bisaat.club");
  });

  it("warns once in production when unset or invalid", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "");
    siteUrl();
    vi.stubEnv("SITE_URL", "nope");
    siteUrl();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(MSG);
  });

  it("does not warn in production when valid", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "https://bisaat.club");
    siteUrl();
    expect(warn).not.toHaveBeenCalled();
  });
});
