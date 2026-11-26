export interface RateLimiter {
  hit(key: string, now?: number): { ok: boolean; retryAfterS: number };
  size(): number;
}

const PRUNE_EVERY_HITS = 1000;

/**
 * Fixed-window, in-memory limiter with a bounded key set. Expired entries are
 * pruned at most once per window (or every 1000 hits); when the map is full the
 * oldest-inserted entries are evicted.
 */
export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  let lastPrune: number | null = null;
  let hitsSincePrune = 0;

  function prune(now: number) {
    for (const [k, w] of windows) {
      if (now - w.start >= windowMs) windows.delete(k);
    }
    lastPrune = now;
    hitsSincePrune = 0;
  }

  return {
    hit(key, now = Date.now()) {
      hitsSincePrune += 1;
      if (lastPrune === null || now - lastPrune >= windowMs || hitsSincePrune >= PRUNE_EVERY_HITS) {
        prune(now);
      }
      let w = windows.get(key);
      if (w && now - w.start >= windowMs) {
        windows.delete(key);
        w = undefined;
      }
      if (!w) {
        while (windows.size >= maxKeys) {
          const oldest = windows.keys().next();
          if (oldest.done) break;
          windows.delete(oldest.value);
        }
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
