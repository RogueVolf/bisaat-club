import { randomBytes } from "node:crypto";
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
});
