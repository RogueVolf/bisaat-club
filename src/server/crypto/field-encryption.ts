import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ConfigError } from "@/server/errors";

/**
 * Application-level encryption for personal data (bookings, phone numbers, payments in later phases).
 * Values are encrypted on the server before they are written to MongoDB and decrypted only on the server,
 * with a key that lives in the environment, never in the database or the client bundle. Atlas also
 * encrypts its disks; this layer means a database dump or a leaked read credential exposes ciphertext only.
 *
 * Token format: enc.v1.<keyId>.<iv>.<tag>.<ciphertext>, parts base64url. AES-256-GCM with a random 96-bit
 * IV per value. The caller's `context` (for example "bookings.phone:<bookingId>") is bound in as additional
 * authenticated data, so a value copied into another field or record fails to decrypt.
 *
 * Keys: DATA_ENCRYPTION_KEY (32 random bytes, base64) encrypts and decrypts. During a rotation the old key
 * goes in DATA_ENCRYPTION_KEY_PREVIOUS, which only decrypts, until every value is re-encrypted.
 */

const PREFIX = "enc";
const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

type Key = { id: string; bytes: Buffer };

let keys: { current: Key; all: Map<string, Key> } | null = null;

export class DecryptionError extends Error {
  constructor() {
    super("Could not decrypt field");
    this.name = "DecryptionError";
  }
}

function parseKey(name: string, raw: string | undefined): Key | null {
  const value = raw?.trim();
  if (!value) return null;
  const bytes = /^[A-Za-z0-9+/]+={0,2}$/.test(value) ? Buffer.from(value, "base64") : Buffer.alloc(0);
  if (bytes.length !== 32) throw new ConfigError(`${name} must be 32 random bytes, base64-encoded`);
  // A short fingerprint, not the key: identifies which key encrypted a value.
  const id = createHash("sha256").update("bisaat-key-id").update(bytes).digest("base64url").slice(0, 8);
  return { id, bytes };
}

function loadKeys() {
  if (keys) return keys;
  const current = parseKey("DATA_ENCRYPTION_KEY", process.env.DATA_ENCRYPTION_KEY);
  if (!current) throw new ConfigError("DATA_ENCRYPTION_KEY is not set");
  const previous = parseKey("DATA_ENCRYPTION_KEY_PREVIOUS", process.env.DATA_ENCRYPTION_KEY_PREVIOUS);
  if (previous && previous.id === current.id) throw new ConfigError("DATA_ENCRYPTION_KEY_PREVIOUS must differ from DATA_ENCRYPTION_KEY");
  const all = new Map([[current.id, current]]);
  if (previous) all.set(previous.id, previous);
  keys = { current, all };
  return keys;
}

const aad = (context: string) => Buffer.from(`${VERSION}|${context}`, "utf8");

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${PREFIX}.${VERSION}.`);
}

export function encryptField(plaintext: string, context: string): string {
  const { current } = loadKeys();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", current.bytes, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(context));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, VERSION, current.id, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptField(token: string, context: string): string {
  const { all } = loadKeys();
  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== PREFIX || parts[1] !== VERSION) throw new DecryptionError();
  const key = all.get(parts[2]);
  if (!key) throw new DecryptionError();
  const iv = Buffer.from(parts[3], "base64url");
  const tag = Buffer.from(parts[4], "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new DecryptionError();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key.bytes, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(aad(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(parts[5], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new DecryptionError();
  }
}

/** Test hook: re-read the keys from the environment. */
export function resetEncryptionKeys(): void {
  keys = null;
}
