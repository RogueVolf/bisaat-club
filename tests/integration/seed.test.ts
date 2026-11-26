import { randomBytes } from "node:crypto";
import { SEED } from "../../src/content/seed";
import { MongoClient } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "../../scripts/seed";

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("seed (integration)", () => {
  let client: MongoClient;
  const dbName = `bisaat_test_${randomBytes(6).toString("hex")}`;

  beforeAll(async () => {
    client = new MongoClient(uri as string, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
  });
  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  it("is idempotent", async () => {
    const db = client.db(dbName);
    await seedDatabase(db, { ifEmpty: false });
    const counts = await seedDatabase(db, { ifEmpty: false });
    expect(counts).toEqual({ settings: 1, zones: 6, prices: 6 });
    expect(await db.collection("zones").countDocuments()).toBe(6);
  });

  it("rejects documents with extra fields (code 121)", async () => {
    const db = client.db(dbName);
    await expect(db.collection("zones").insertOne({ _id: "x", bogus: 1 } as never)).rejects.toMatchObject({ code: 121 });
  });

  it("rejects bad edits at write time (code 121) and accepts good ones", async () => {
    const db = client.db(dbName);
    await seedDatabase(db, { ifEmpty: false });
    const settings = db.collection("settings");
    const bad: Record<string, unknown>[] = [
      { openingAt: "next friday" },
      { bookingUrl: "javascript:alert(1)" },
      { bookingUrl: "//evil.com" },
      { bookingUrl: "/\\evil.com" },
      { bookingUrl: "/ok\n" },
      { mapsUrl: "http://maps.example.com" },
      { whatsapp: "9945205694" },
      { instagram: "@bisaat" },
      { bookingLabel: "" },
      { "hours.opens": "9am" },
      { "hours.closes": "25:00" },
    ];
    for (const set of bad) {
      await expect(settings.updateOne({ _id: "site" as never }, { $set: set }), JSON.stringify(set)).rejects.toMatchObject({ code: 121 });
    }
    await expect(db.collection("zones").updateOne({ _id: "ps5" as never }, { $set: { id: "PS5" } })).rejects.toMatchObject({ code: 121 });
    await expect(db.collection("prices").updateOne({ _id: SEED.prices[0].id as never }, { $set: { id: "" } })).rejects.toMatchObject({ code: 121 });

    const ok = await db.collection("zones").updateOne({ _id: "ps5" as never }, { $set: { title: "Edited title" } });
    expect(ok.modifiedCount).toBe(1);
    await settings.updateOne({ _id: "site" as never }, { $set: { bookingUrl: "https://wa.me/919945205694?text=hi" } });
    await settings.updateOne({ _id: "site" as never }, { $set: { bookingUrl: "/book" } });
  });
});
