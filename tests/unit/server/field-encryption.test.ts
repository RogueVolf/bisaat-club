import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptField, encryptField, isEncrypted, resetEncryptionKeys } from "@/server/crypto/field-encryption";

const key = () => randomBytes(32).toString("base64");

describe("field encryption", () => {
  let current: string;
  beforeEach(() => {
    current = key();
    vi.stubEnv("DATA_ENCRYPTION_KEY", current);
    vi.stubEnv("DATA_ENCRYPTION_KEY_PREVIOUS", "");
    resetEncryptionKeys();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEncryptionKeys();
  });

  it("round-trips text, including non-ASCII and empty strings", () => {
    for (const s of ["+919945205694", "Ayesha Khan", "₹500 · ಬೆಂಗಳೂರು", ""]) {
      const token = encryptField(s, "bookings.phone:abc");
      expect(isEncrypted(token)).toBe(true);
      expect(token).not.toContain(s || "\u0000");
      expect(decryptField(token, "bookings.phone:abc")).toBe(s);
    }
  });

  it("uses a fresh IV, so the same value encrypts differently each time", () => {
    expect(encryptField("same", "c")).not.toBe(encryptField("same", "c"));
  });

  it("rejects a token used under a different context (no swapping values between fields or records)", () => {
    const token = encryptField("+919945205694", "bookings.phone:1");
    expect(() => decryptField(token, "bookings.phone:2")).toThrow("Could not decrypt field");
  });

  it("rejects any tampered part", () => {
    const token = encryptField("secret", "c");
    const parts = token.split(".");
    for (let i = 2; i < parts.length; i++) {
      const p = [...parts];
      const b = Buffer.from(p[i], "base64url");
      b[0] ^= 1;
      p[i] = b.toString("base64url");
      expect(() => decryptField(p.join("."), "c")).toThrow("Could not decrypt field");
    }
    expect(() => decryptField("enc.v1.x", "c")).toThrow("Could not decrypt field");
    expect(() => decryptField("plain text", "c")).toThrow("Could not decrypt field");
  });

  it("decrypts values written with the previous key after rotation, and encrypts with the new one", () => {
    const old = encryptField("before rotation", "c");
    vi.stubEnv("DATA_ENCRYPTION_KEY_PREVIOUS", current);
    vi.stubEnv("DATA_ENCRYPTION_KEY", key());
    resetEncryptionKeys();
    expect(decryptField(old, "c")).toBe("before rotation");
    const fresh = encryptField("after rotation", "c");
    expect(fresh.split(".")[2]).not.toBe(old.split(".")[2]);
    vi.stubEnv("DATA_ENCRYPTION_KEY_PREVIOUS", "");
    resetEncryptionKeys();
    expect(() => decryptField(old, "c")).toThrow("Could not decrypt field");
    expect(decryptField(fresh, "c")).toBe("after rotation");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["too short", randomBytes(16).toString("base64")],
    ["not base64", "not a key at all, definitely not 32 bytes!!"],
  ])("refuses a %s key without echoing it", (_n, v) => {
    if (v === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else vi.stubEnv("DATA_ENCRYPTION_KEY", v);
    resetEncryptionKeys();
    let message = "";
    try {
      encryptField("x", "c");
    } catch (e) {
      message = (e as Error).message;
      expect((e as Error).name).toBe("ConfigError");
    }
    expect(message).toMatch(/^DATA_ENCRYPTION_KEY /);
    if (v) expect(message).not.toContain(v);
  });

  it("refuses a previous key equal to the current one", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY_PREVIOUS", current);
    resetEncryptionKeys();
    expect(() => encryptField("x", "c")).toThrow("DATA_ENCRYPTION_KEY_PREVIOUS must differ");
  });
});
