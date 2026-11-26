import { describe, expect, it } from "vitest";
import { MODE_BOOT_SCRIPT, parseDeepLink } from "@/walkthrough/deep-link";
import { SEED } from "@/content/seed";

const ids = SEED.zones.map((z) => z.id);

describe("parseDeepLink", () => {
  it.each([
    ["#lib", { zone: "lib", mode: null }],
    ["#lib-night", { zone: "lib", mode: "night" }],
    ["#night", { zone: null, mode: "night" }],
    ["#lib-day", { zone: "lib", mode: "day" }],
    ["#door-night", { zone: null, mode: "night" }],
    ["#door", { zone: null, mode: null }],
    ["#foo", { zone: null, mode: null }],
    ["", { zone: null, mode: null }],
    ["#night-lib", { zone: null, mode: "night" }],
    ["#lib-day-night", { zone: "lib", mode: "night" }],
  ])("%s", (hash, expected) => {
    expect(parseDeepLink(hash, ids)).toEqual(expected);
  });
});

/** Runs the inline <head> script against a fake page and returns the data-mode it sets. */
function runBoot(hash: string, prefersDark: boolean | null): string | undefined {
  const html = { dataset: {} as Record<string, string> };
  const win = { matchMedia: prefersDark === null ? undefined : (q: string) => ({ matches: q === "(prefers-color-scheme: dark)" && prefersDark }) };
  new Function("location", "window", "document", MODE_BOOT_SCRIPT)({ hash }, win, { documentElement: html });
  return html.dataset.mode;
}

describe("MODE_BOOT_SCRIPT (sets data-mode before first paint, same rules as the controller's start)", () => {
  const hashes = ["#lib", "#lib-night", "#night", "#lib-day", "#door-night", "#door", "#foo", "", "#night-lib", "#lib-day-night", "#day"];
  it.each(hashes.flatMap((h) => [true, false, null].map((d) => [h, d] as const)))("%s, prefers dark %s", (hash, dark) => {
    // The controller: setMode(prefers dark), then a #...-night / #...-day link overrides it
    const expected = parseDeepLink(hash, ids).mode ?? (dark ? "night" : "day");
    expect(runBoot(hash, dark)).toBe(expected);
  });
  it("is a single self-contained statement with no closing script tag", () => {
    expect(MODE_BOOT_SCRIPT).not.toMatch(/<\/script/i);
    expect(MODE_BOOT_SCRIPT.length).toBeLessThan(400);
  });
});
