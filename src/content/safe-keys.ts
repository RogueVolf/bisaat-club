export class UnsafeInputError extends Error {
  /** Dotted location of the first unsafe key (key names only, never values). */
  readonly path: string;
  constructor(message = "Input contains unsafe keys", path = "") {
    super(message);
    this.name = "UnsafeInputError";
    this.path = path;
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

function findUnsafePath(value: unknown, path: string[]): string[] | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const r = findUnsafePath(value[i], [...path, String(i)]);
      if (r) return r;
    }
  } else if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith("$") || k.includes(".")) return [...path, k];
      const r = findUnsafePath(v, [...path, k]);
      if (r) return r;
    }
  }
  return null;
}

export function assertSafeKeys(value: unknown): void {
  const p = findUnsafePath(value, []);
  if (p) throw new UnsafeInputError(undefined, p.join("/"));
}
