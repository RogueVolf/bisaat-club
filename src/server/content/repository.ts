import "server-only";
import { unstable_cache } from "next/cache";
import { SEED } from "@/content/seed";
import { SiteContentSchema, type SiteContent } from "@/content/schema";
import { assertSafeKeys } from "@/content/safe-keys";
import { getReadDb } from "@/server/db/client";
import { describeFallback } from "./describe-error";
import { COLLECTIONS } from "@/server/db/validators";

function stripId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc;
  void _id;
  return rest;
}

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

export async function loadSiteContentFromDb(): Promise<SiteContent> {
  const db = await getReadDb();
  const [settings, zones, prices] = await Promise.all([
    db.collection(COLLECTIONS.settings).find({ _id: "site" as never }).toArray(),
    db.collection(COLLECTIONS.zones).find({}).toArray(),
    db.collection(COLLECTIONS.prices).find({}).toArray(),
  ]);
  if (settings.length !== 1) throw new Error("settings document missing");
  if (zones.length === 0 || prices.length === 0) throw new Error("content collections empty");
  const raw = {
    settings: stripId(settings[0]),
    zones: zones.map(stripId),
    prices: prices.map(stripId),
  };
  assertSafeKeys(raw);
  const content = SiteContentSchema.parse(raw) as SiteContent;
  return {
    ...content,
    zones: [...content.zones].sort(byOrder),
    prices: [...content.prices].sort(byOrder),
  };
}

type Result = { content: SiteContent; source: "db" | "fallback" };

async function load(): Promise<Result> {
  try {
    return { content: await loadSiteContentFromDb(), source: "db" };
  } catch (e) {
    console.warn(`content: falling back to bundled seed (${describeFallback(e)})`);
    return { content: SEED, source: "fallback" };
  }
}

export const getSiteContent: () => Promise<Result> = unstable_cache(load, ["site-content"], {
  revalidate: 60,
  tags: ["content"],
});
