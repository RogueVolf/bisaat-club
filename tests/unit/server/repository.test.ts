import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED } from "@/content/seed";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
const getReadDb = vi.fn();
vi.mock("@/server/db/client", () => ({ getReadDb: () => getReadDb() }));

import { getSiteContent } from "@/server/content/repository";
import { assertTlsPolicy } from "@/server/db/tls";
import { ConfigError, TlsPolicyError } from "@/server/errors";

function fakeDb(zones: unknown[], pricesOverride?: unknown[]) {
  const data: Record<string, unknown[]> = {
    settings: [{ _id: "site", ...SEED.settings }],
    zones,
    prices: pricesOverride ?? SEED.prices.map((p) => ({ _id: p.id, ...p })),
  };
  return {
    collection: (name: string) => ({ find: () => ({ toArray: async () => data[name] }) }),
  };
}
const seedZones = () => SEED.zones.map((z) => ({ _id: z.id, ...z }));

describe("getSiteContent", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    getReadDb.mockReset();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("falls back to SEED when the DB is unreachable", async () => {
    const err = new Error("secret mongodb://u:p@h/db");
    err.name = "MongoServerSelectionError";
    getReadDb.mockRejectedValue(err);
    const r = await getSiteContent();
    expect(r.source).toBe("fallback");
    expect(r.content).toEqual(SEED);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toBe("content: falling back to bundled seed (MongoServerSelectionError)");
    expect(line).not.toContain("mongodb://");
  });

  const lastLine = () => String(warn.mock.calls[warn.mock.calls.length - 1][0]);

  it("logs the safe message for ConfigError and TlsPolicyError", async () => {
    getReadDb.mockRejectedValue(new ConfigError("MONGODB_DB is not set"));
    await getSiteContent();
    expect(lastLine()).toBe("content: falling back to bundled seed (ConfigError: MONGODB_DB is not set)");
    getReadDb.mockRejectedValue(new TlsPolicyError());
    await getSiteContent();
    expect(lastLine()).toBe(
      "content: falling back to bundled seed (TlsPolicyError: MongoDB connection must use TLS with certificate checks in production)",
    );
  });

  it("logs ZodError paths and codes only, never values", async () => {
    const zones = seedZones();
    (zones[2] as Record<string, unknown>).title = 42;
    const settings = { _id: "site", ...SEED.settings, openingAt: "next friday secret-pw" };
    const db = fakeDb(zones);
    const base = db.collection;
    db.collection = (n: string) =>
      n === "settings" ? { find: () => ({ toArray: async () => [settings] }) } : base(n);
    getReadDb.mockResolvedValue(db);
    await getSiteContent();
    const line = lastLine();
    expect(line).toMatch(/^content: falling back to bundled seed \(2 invalid field\(s\): /);
    expect(line).toContain("settings.openingAt:invalid_format");
    expect(line).toContain("zones.2.title:invalid_type");
    expect(line).not.toContain("next friday");
    expect(line).not.toContain("secret-pw");
    expect(line).not.toContain("42");
  });

  it("logs only the key path for UnsafeInputError", async () => {
    const zones = seedZones();
    (zones[0] as Record<string, unknown>)["$where"] = "sleep-secret";
    getReadDb.mockResolvedValue(fakeDb(zones));
    await getSiteContent();
    expect(lastLine()).toBe("content: falling back to bundled seed (UnsafeInputError: unsafe key at zones/0/$where)");
  });

  it("never logs URIs, passwords or messages for unknown errors", async () => {
    const err = new Error("connect failed mongodb://u:hunter2@h/db");
    getReadDb.mockRejectedValue(err);
    await getSiteContent();
    expect(lastLine()).toBe("content: falling back to bundled seed (Error)");
    expect(lastLine()).not.toContain("hunter2");
  });

  it("sorts zones and prices by order", async () => {
    const zones = seedZones().reverse();
    const prices = SEED.prices.map((p) => ({ _id: p.id, ...p })).reverse();
    getReadDb.mockResolvedValue(fakeDb(zones, prices));
    const r = await getSiteContent();
    expect(r.source).toBe("db");
    expect(r.content.zones.map((z) => z.order)).toEqual([...r.content.zones.map((z) => z.order)].sort((a, b) => a - b));
    expect(r.content.zones.map((z) => z.id)).toEqual(SEED.zones.map((z) => z.id));
    expect(r.content.prices.map((p) => p.id)).toEqual(SEED.prices.map((p) => p.id));
  });

  it("falls back when a zone has an unsafe key", async () => {
    const zones = seedZones();
    (zones[0] as Record<string, unknown>)["$where"] = "1";
    getReadDb.mockResolvedValue(fakeDb(zones));
    const r = await getSiteContent();
    expect(r.source).toBe("fallback");
    expect(r.content).toEqual(SEED);
  });

  it("falls back when zones are empty", async () => {
    getReadDb.mockResolvedValue(fakeDb([]));
    expect((await getSiteContent()).source).toBe("fallback");
  });

  it("falls back when prices are empty", async () => {
    getReadDb.mockResolvedValue(fakeDb(seedZones(), []));
    expect((await getSiteContent()).source).toBe("fallback");
  });

  it("returns DB content when valid", async () => {
    const zones = seedZones();
    zones[1] = { ...zones[1], title: "Changed title" } as (typeof zones)[number];
    getReadDb.mockResolvedValue(fakeDb(zones));
    const r = await getSiteContent();
    expect(r.source).toBe("db");
    expect(r.content.zones[1].title).toBe("Changed title");
    expect(r.content.zones[1]).not.toHaveProperty("_id");
  });
});

describe("assertTlsPolicy", () => {
  it("enforces TLS in production only", () => {
    expect(() => assertTlsPolicy("mongodb://h/db", "production")).toThrow();
    expect(() => assertTlsPolicy("mongodb://h/db?tls=true", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb://h/db?ssl=true", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb+srv://h/db", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb://h/db", "development")).not.toThrow();
  });
  it("rejects weakened TLS in production", () => {
    for (const q of [
      "tls=false", "ssl=false", "TLS=FALSE", "tls=true&tlsInsecure=true",
      "tls=true&tlsAllowInvalidCertificates=true", "tls=true&tlsAllowInvalidHostnames=true",
      "tlsinsecure=true",
    ]) {
      expect(() => assertTlsPolicy(`mongodb://h/db?${q}`, "production"), q).toThrow();
    }
    expect(() => assertTlsPolicy("mongodb+srv://h/db?tls=false", "production")).toThrow();
    expect(() => assertTlsPolicy("mongodb+srv://h/db?tlsInsecure=true", "production")).toThrow();
  });
  it("allows loopback-only hosts without TLS in production", () => {
    expect(() => assertTlsPolicy("mongodb://u:p@127.0.0.1:27017/bisaat", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb://localhost/db", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb://[::1]:27017/db", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb://127.0.0.1,db.example.com/db", "production")).toThrow();
    expect(() => assertTlsPolicy("mongodb://127.0.0.1.evil.com/db", "production")).toThrow();
    expect(() => assertTlsPolicy("mongodb://localhost.example.com/db", "production")).toThrow();
  });
  it("does not leak the URI", () => {
    const uri = "mongodb://user:pw@h/db";
    let message = "";
    expect(() => {
      try {
        assertTlsPolicy(uri, "production");
      } catch (e) {
        message = (e as Error).message;
        throw e;
      }
    }).toThrow();
    expect(message).not.toBe("");
    expect(message).not.toContain(uri);
    expect(message).not.toContain("pw");
  });
});
