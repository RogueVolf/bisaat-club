export interface RateLimiter {
  hit(key: string, now?: number): { ok: boolean; retryAfterS: number };
  size(): number;
}

/** Fixed-window, in-memory limiter. Expired entries are pruned on each hit. */
export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    hit(key, now = Date.now()) {
      for (const [k, w] of windows) {
        if (now - w.start >= windowMs) windows.delete(k);
      }
      let w = windows.get(key);
      if (!w) {
        w = { start: now, count: 0 };
        windows.set(key, w);
      }
      w.count += 1;
      const retryAfterS = Math.max(1, Math.ceil((w.start + windowMs - now) / 1000));
      return { ok: w.count <= limit, retryAfterS };
    },
    size: () => windows.size,
  };
}
