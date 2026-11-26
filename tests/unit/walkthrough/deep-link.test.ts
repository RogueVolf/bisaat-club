import { describe, expect, it } from "vitest";
import { parseDeepLink } from "@/walkthrough/deep-link";
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
