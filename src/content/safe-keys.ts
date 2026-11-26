export class UnsafeInputError extends Error {
  constructor(message = "Input contains unsafe keys") {
    super(message);
    this.name = "UnsafeInputError";
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** True if any key (at any depth of plain objects/arrays) starts with `$` or contains `.`. */
export function hasUnsafeKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUnsafeKeys);
  if (isPlainObject(value)) {
    return Object.entries(value).some(
      ([k, v]) => k.startsWith("$") || k.includes(".") || hasUnsafeKeys(v),
    );
  }
  return false;
}

export function assertSafeKeys(value: unknown): void {
  if (hasUnsafeKeys(value)) throw new UnsafeInputError();
}
