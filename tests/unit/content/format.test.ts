import { describe, expect, it } from "vitest";
import { formatCountdown, formatOpensLabel, isOpen } from "@/content/format";
import { SEED } from "@/content/seed";

describe("formatCountdown", () => {
  it("formats d h m to go", () => {
    expect(
      formatCountdown("2026-12-12T09:00:00+05:30", Date.parse("2026-12-11T08:00:00+05:30")),
    ).toBe("1d 1h 0m to go");
  });
  it("clamps at zero after opening", () => {
    expect(
      formatCountdown("2026-12-12T09:00:00+05:30", Date.parse("2026-12-13T08:00:00+05:30")),
    ).toBe("0d 0h 0m to go");
  });
});

describe("formatOpensLabel", () => {
  it("formats the seed date", () => {
    expect(formatOpensLabel(SEED.settings.openingAt, SEED.settings.timezone)).toBe("Opens Sat 12 Dec");
  });
});

describe("isOpen", () => {
  const at = "2026-12-12T09:00:00+05:30";
  it("is false a minute before opening", () => {
    expect(isOpen(at, Date.parse("2026-12-12T08:59:00+05:30"))).toBe(false);
  });
  it("is true at the opening minute and after", () => {
    expect(isOpen(at, Date.parse(at))).toBe(true);
    expect(isOpen(at, Date.parse("2027-01-01T00:00:00+05:30"))).toBe(true);
  });
});
