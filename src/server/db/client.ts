import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { MongoClient, type Db } from "mongodb";
import { ConfigError } from "@/server/errors";
import { assertTlsPolicy } from "./tls";

export { assertTlsPolicy };

type Role = "read" | "write";
const ENV: Record<Role, string> = { read: "MONGODB_URI_READ", write: "MONGODB_URI_WRITE" };

const g = globalThis as unknown as { __bisaatMongo?: Partial<Record<Role, Promise<MongoClient>>> };

function connect(role: Role): Promise<MongoClient> {
  const cache = (g.__bisaatMongo ??= {});
  const existing = cache[role];
  if (existing) return existing;
  const uri = process.env[ENV[role]];
  if (!uri) throw new ConfigError(`${ENV[role]} is not set`);
  assertTlsPolicy(uri, process.env.NODE_ENV ?? "development");
  // maxIdleTimeMS plus attachDatabasePool let Vercel close idle connections before a function instance is
  // suspended, so connections do not leak against the Atlas limit. attachDatabasePool is a no-op off Vercel.
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000, maxIdleTimeMS: 5000, appName: "bisaat-club" });
  attachDatabasePool(client);
  const p = client.connect().catch(async (e: unknown) => {
    delete cache[role];
    await client.close().catch(() => {});
    throw e;
  });
  cache[role] = p;
  return p;
}

function dbName(): string {
  const name = process.env.MONGODB_DB;
  if (!name) throw new ConfigError("MONGODB_DB is not set");
  return name;
}

export async function getReadDb(): Promise<Db> {
  return (await connect("read")).db(dbName());
}

export async function getWriteDb(): Promise<Db> {
  return (await connect("write")).db(dbName());
}
