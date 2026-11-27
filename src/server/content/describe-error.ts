import { ZodError } from "zod";
import { UnsafeInputError } from "@/content/safe-keys";
import { ConfigError, TlsPolicyError } from "@/server/errors";

const MAX_ISSUES = 8;

/** Printable, bounded form of a path segment (it may come from stored data). */
const seg = (s: PropertyKey) => String(s).replace(/[^\w$.-]/g, "?").slice(0, 40);

/**
 * Secret-safe one-line reason for a content fallback. Only app-owned messages, field paths and
 * issue codes are ever included, never values, URIs or messages from drivers or libraries.
 */
export function describeFallback(e: unknown): string {
  if (e instanceof ConfigError || e instanceof TlsPolicyError) return `${e.name}: ${e.message}`;
  if (e instanceof ZodError) {
    const issues = e.issues.slice(0, MAX_ISSUES).map((i) => `${i.path.map(seg).join(".") || "(root)"}:${i.code}`);
    const more = e.issues.length > MAX_ISSUES ? ` +${e.issues.length - MAX_ISSUES} more` : "";
    return `${e.issues.length} invalid field(s): ${issues.join(", ")}${more}`;
  }
  if (e instanceof UnsafeInputError) return `UnsafeInputError: unsafe key at ${e.path.split("/").map(seg).join("/") || "(unknown)"}`;
  return e instanceof Error ? e.name : "UnknownError";
}
