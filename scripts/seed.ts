import { pathToFileURL } from "node:url";
import { MongoClient, type Db } from "mongodb";
import { SEED } from "../src/content/seed";
import { COLLECTIONS, VALIDATION_OPTIONS, VALIDATORS } from "../src/server/db/validators";

export type SeedCounts = { settings: number; zones: number; prices: number };

export async function seedDatabase(db: Db, opts: { ifEmpty: boolean }): Promise<SeedCounts> {
  const docs: Record<keyof typeof COLLECTIONS, { _id: string }[]> = {
    settings: [{ _id: "site", ...SEED.settings }],
    zones: SEED.zones.map((z) => ({ _id: z.id, ...z })),
    prices: SEED.prices.map((p) => ({ _id: p.id, ...p })),
  };
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const key of Object.keys(COLLECTIONS) as (keyof typeof COLLECTIONS)[]) {
    const name = COLLECTIONS[key];
    const options = { validator: VALIDATORS[key], ...VALIDATION_OPTIONS };
    if (existing.has(name)) {
      if (opts.ifEmpty && (await db.collection(name).countDocuments({}, { limit: 1 })) > 0) continue;
      await db.command({ collMod: name, ...options });
    } else {
      await db.createCollection(name, options);
    }
    for (const doc of docs[key]) {
      await db.collection(name).replaceOne({ _id: doc._id as never }, doc, { upsert: true });
    }
  }

  return {
    settings: await db.collection(COLLECTIONS.settings).countDocuments(),
    zones: await db.collection(COLLECTIONS.zones).countDocuments(),
    prices: await db.collection(COLLECTIONS.prices).countDocuments(),
  };
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // rely on the ambient environment
  }
  const uri = process.env.MONGODB_URI_WRITE;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    console.error("MONGODB_URI_WRITE and MONGODB_DB must be set");
    process.exit(1);
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const c = await seedDatabase(client.db(dbName), { ifEmpty: process.argv.includes("--if-empty") });
    console.log(`settings ${c.settings}, zones ${c.zones}, prices ${c.prices}`);
  } catch (e) {
    console.error(`seed failed (${e instanceof Error ? e.name : "error"})`);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
