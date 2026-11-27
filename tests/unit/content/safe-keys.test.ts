import { describe, expect, it } from "vitest";
import { assertSafeKeys, hasUnsafeKeys, UnsafeInputError } from "@/content/safe-keys";

describe("hasUnsafeKeys", () => {
  it("flags keys starting with $", () => {
    expect(hasUnsafeKeys({ $where: 1 })).toBe(true);
  });
  it("flags keys containing a dot, nested", () => {
    expect(hasUnsafeKeys({ a: { "b.c": 1 } })).toBe(true);
  });
  it("recurses into arrays", () => {
    expect(hasUnsafeKeys([{ $gt: 1 }])).toBe(true);
  });
  it("ignores unsafe characters in values", () => {
    expect(hasUnsafeKeys({ a: "x.$y" })).toBe(false);
  });
  it("accepts primitives and null", () => {
    expect(hasUnsafeKeys(null)).toBe(false);
    expect(hasUnsafeKeys(5)).toBe(false);
    expect(hasUnsafeKeys({ a: [1, { b: null }] })).toBe(false);
  });
});

describe("assertSafeKeys", () => {
  it("throws UnsafeInputError on unsafe keys", () => {
    expect(() => assertSafeKeys({ $where: 1 })).toThrow(UnsafeInputError);
  });
  it("does not throw on safe input", () => {
    expect(() => assertSafeKeys({ a: 1 })).not.toThrow();
  });
});
