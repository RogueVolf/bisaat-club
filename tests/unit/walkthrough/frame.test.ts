import { describe, expect, it } from "vitest";
import { needsFrame, resolutionStep, spotDom, spotWrites, SHARPEN_MS } from "@/walkthrough/frame";
import type { HotspotPlacement } from "@/walkthrough/hotspots";

const idle = { dirty: false, walking: false, dragging: false, fading: false, lowRes: false };

describe("needsFrame", () => {
  it("is false when nothing is happening, so the loop stops (0 idle frames per second)", () => {
    expect(needsFrame(idle)).toBe(false);
  });
  it.each(["dirty", "walking", "dragging", "fading", "lowRes"] as const)("is true while %s", (k) => {
    expect(needsFrame({ ...idle, [k]: true })).toBe(true);
  });
});

describe("resolutionStep", () => {
  const base = { moving: false, dirty: false, lowRes: false, now: 1000, sharpAt: 0 };
  it("drops to low res for a moving frame that will draw, and pushes the sharpen out 140 ms", () => {
    expect(resolutionStep({ ...base, moving: true, dirty: true })).toEqual({ low: true, sharpAt: 1000 + SHARPEN_MS });
  });
  it("a press without movement (moving, nothing to draw) keeps the full-res canvas, so a tap never clears it", () => {
    expect(resolutionStep({ ...base, moving: true })).toEqual({ low: false, sharpAt: 1000 + SHARPEN_MS });
  });
  it("stays low while moving once low, even on frames with nothing to draw", () => {
    expect(resolutionStep({ ...base, moving: true, lowRes: true })).toEqual({ low: true, sharpAt: 1000 + SHARPEN_MS });
  });
  it("stays low until the sharpen time has passed", () => {
    expect(resolutionStep({ ...base, lowRes: true, sharpAt: 1000 })).toEqual({ low: true, sharpAt: 1000 });
    expect(resolutionStep({ ...base, lowRes: true, sharpAt: 999 })).toEqual({ low: false, sharpAt: 999 });
  });
  it("leaves a still full-res canvas alone", () => {
    expect(resolutionStep(base)).toEqual({ low: false, sharpAt: 0 });
  });
});

const P = (o: Partial<HotspotPlacement>): HotspotPlacement => ({ id: "x", hidden: false, x: 0, y: 0, side: "l", pinned: false, ...o });

describe("spotDom (reference hotspot styling)", () => {
  it("hidden spots only change hidden", () => {
    expect(spotDom(P({ hidden: true }))).toEqual({ hidden: true });
  });
  it("on-screen spots use one decimal", () => {
    expect(spotDom(P({ x: 83.44, y: 216 }))).toEqual({ hidden: false, right: false, transform: "translate(83.4px,216.0px)" });
  });
  it("pinned left spots use the raw numbers", () => {
    expect(spotDom(P({ pinned: true, side: "l", x: 18, y: 262 }))).toEqual({ hidden: false, right: false, transform: "translate(18px,262px)" });
  });
  it("pinned right spots get the r class and shift left by their width", () => {
    expect(spotDom(P({ pinned: true, side: "r", x: 380, y: 308 }))).toEqual({ hidden: false, right: true, transform: "translate(380px,308px) translateX(-100%)" });
  });
});

describe("spotWrites (only touch the DOM when a value changes)", () => {
  it("writes everything the first time", () => {
    expect(spotWrites({}, { hidden: false, right: true, transform: "t" })).toEqual({ hidden: false, right: true, transform: "t" });
  });
  it("writes nothing when nothing changed", () => {
    expect(spotWrites({ hidden: false, right: true, transform: "t" }, { hidden: false, right: true, transform: "t" })).toEqual({});
  });
  it("writes only the changed field", () => {
    expect(spotWrites({ hidden: false, right: false, transform: "a" }, { hidden: false, right: false, transform: "b" })).toEqual({ transform: "b" });
    expect(spotWrites({ hidden: false, right: false, transform: "a" }, { hidden: false, right: true, transform: "a" })).toEqual({ right: true });
  });
  it("hiding keeps the previous transform and class, like the reference", () => {
    expect(spotWrites({ hidden: false, right: true, transform: "a" }, { hidden: true })).toEqual({ hidden: true });
    expect(spotWrites({ hidden: true, right: true, transform: "a" }, { hidden: true })).toEqual({});
  });
  it("showing again after hiding rewrites only hidden when position is unchanged", () => {
    expect(spotWrites({ hidden: true, right: false, transform: "a" }, { hidden: false, right: false, transform: "a" })).toEqual({ hidden: false });
  });
});
