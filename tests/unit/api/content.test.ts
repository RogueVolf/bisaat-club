import { beforeEach, describe, expect, it, vi } from "vitest";
import { SEED } from "@/content/seed";
import { SiteContentSchema } from "@/content/schema";

const getSiteContent = vi.fn();
vi.mock("@/server/content/repository", () => ({
  getSiteContent: () => getSiteContent(),
}));

import { GET } from "@/app/api/content/route";

const req = (qs = "") => new Request(`http://localhost/api/content${qs}`);

beforeEach(() => {
  getSiteContent.mockReset();
  getSiteContent.mockResolvedValue({ content: SEED, source: "db" });
});

describe("GET /api/content", () => {
  it("returns validated content with cache headers", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    const body = await res.json();
    expect(body.source).toBe("db");
    expect(SiteContentSchema.safeParse(body.content).success).toBe(true);
  });

  it.each(["?$where=1", "?a.b=1", "?x=1", "?__proto__=x"])("rejects %s with 400", async (qs) => {
    const res = await GET(req(qs));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_query" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(getSiteContent).not.toHaveBeenCalled();
  });

  it("returns 500 content_invalid when content fails the schema", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    getSiteContent.mockResolvedValue({ content: { settings: {} }, source: "db" });
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "content_invalid" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
