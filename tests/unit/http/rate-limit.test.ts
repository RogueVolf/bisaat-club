import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/server/http/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit then blocks with retryAfterS", () => {
    const l = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(l.hit("a", 0).ok).toBe(true);
    expect(l.hit("a", 1000).ok).toBe(true);
    const r = l.hit("a", 2000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterS).toBe(58);
  });

  it("tracks keys independently", () => {
    const l = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(l.hit("a", 0).ok).toBe(true);
    expect(l.hit("b", 0).ok).toBe(true);
    expect(l.hit("a", 1).ok).toBe(false);
  });

  it("resets after the window", () => {
    const l = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(l.hit("a", 0).ok).toBe(true);
    expect(l.hit("a", 59_999).ok).toBe(false);
    expect(l.hit("a", 60_000).ok).toBe(true);
  });

  it("prunes expired entries", () => {
    const l = createRateLimiter({ limit: 1, windowMs: 1000 });
    l.hit("a", 0);
    l.hit("b", 5000);
    expect(l.size()).toBe(1);
  });
});
