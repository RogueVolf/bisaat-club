import { describe, expect, it } from "vitest";
import { placeHotspots, type HotspotInput } from "@/walkthrough/hotspots";

type P = [number, number, number];
const A: P = [1, 1, 1], B: P = [2, 1, 1], C: P = [3, 1, 1];

function input(over: Partial<HotspotInput>): HotspotInput {
  return {
    spots: [], current: "door", walking: false, W: 390, H: 468,
    camX: 0, camZ: 0, yawNow: 0, project: () => null, ...over,
  };
}
const fixed = (map: Map<P, [number, number] | null>) => (p: P) => {
  const v = map.get(p);
  return v ? [v[0], v[1]] as [number, number] : null;
};

describe("placeHotspots", () => {
  it("hides the current zone unless walking", () => {
    const spots = [{ id: "lib", at: A }];
    const still = placeHotspots(input({ spots, current: "lib", walking: false, project: () => [100, 100] }));
    expect(still[0].hidden).toBe(true);
    const moving = placeHotspots(input({ spots, current: "lib", walking: true, project: () => [100, 100] }));
    expect(moving[0].hidden).toBe(false);
    expect(moving[0]).toMatchObject({ x: 100, y: 100, side: "l", pinned: false });
  });

  it("pins an off-screen spot with negative bearing to the left edge at mid-height", () => {
    // camera at origin looking down -z (yaw 0); point at bearing -45 degrees, projection null
    const out = placeHotspots(input({ spots: [{ id: "ps5", at: [-1, 1, -1] }], H: 468 }));
    expect(out[0]).toMatchObject({ id: "ps5", hidden: false, x: 18, y: 468 * .5, side: "l", pinned: true });
  });

  it("pins an off-screen spot with positive bearing to the right edge", () => {
    const out = placeHotspots(input({ spots: [{ id: "lib", at: [1, 1, -1] }], W: 390, H: 468 }));
    expect(out[0]).toMatchObject({ x: 390 - 10, y: 234, side: "r", pinned: true });
  });

  it("stacks pinned spots on one side 46 px apart", () => {
    const out = placeHotspots(input({ spots: [{ id: "a", at: [-1, 1, -1] }, { id: "b", at: [-2, 1, -1] }], H: 468 }));
    expect(out[0].y).toBe(234);
    expect(out[1].y).toBe(234 + 46);
  });

  it("treats projections outside 14 / W-120 / 30 / H-50 as off-screen", () => {
    const at: P = [-1, 1, -1];
    for (const p of [[13, 100], [391 - 120, 100], [100, 29], [100, 468 - 49]] as [number, number][]) {
      const out = placeHotspots(input({ spots: [{ id: "x", at }], project: () => [p[0], p[1]] }));
      expect(out[0].pinned).toBe(true);
    }
    const edge = placeHotspots(input({ spots: [{ id: "x", at }], project: () => [14, 30] }));
    expect(edge[0].pinned).toBe(false);
  });

  it("nudges two on-screen spots within 150x44 apart by 46 px", () => {
    const map = new Map<P, [number, number] | null>([[A, [100, 200]], [B, [150, 210]]]);
    const out = placeHotspots(input({ spots: [{ id: "a", at: A }, { id: "b", at: B }], project: fixed(map) }));
    expect(out[0]).toMatchObject({ x: 100, y: 200 });
    expect(out[1]).toMatchObject({ x: 150, y: 246 });
  });

  it("nudges upward when the later spot is above", () => {
    const map = new Map<P, [number, number] | null>([[A, [100, 200]], [B, [120, 180]]]);
    const out = placeHotspots(input({ spots: [{ id: "a", at: A }, { id: "b", at: B }], project: fixed(map) }));
    expect(out[1].y).toBe(154);
  });

  it("leaves spots far apart alone", () => {
    const map = new Map<P, [number, number] | null>([[A, [100, 200]], [C, [260, 200]]]);
    const out = placeHotspots(input({ spots: [{ id: "a", at: A }, { id: "c", at: C }], project: fixed(map) }));
    expect(out[1]).toMatchObject({ x: 260, y: 200 });
  });

  it("on desktop, pins a spot that projects into the bottom-left sheet area, always to the right", () => {
    const W = 1280, H = 800;
    // camera faces -z, the point is to the left (negative bearing) but desktop never pins left
    const out = placeHotspots(input({ spots: [{ id: "games", at: [-1, 1, -1] }], W, H, project: () => [200, 700] }));
    expect(out[0]).toMatchObject({ hidden: false, x: W - 10, y: H * .5, side: "r", pinned: true });
    // above the sheet area the same spot stays on-screen
    const above = placeHotspots(input({ spots: [{ id: "games", at: [-1, 1, -1] }], W, H, project: () => [200, 400] }));
    expect(above[0].pinned).toBe(false);
  });

  it("pushes a pinned spot below an on-screen spot it would overlap", () => {
    const map = new Map<P, [number, number] | null>([[A, [30, 240]], [B, null]]);
    const out = placeHotspots(input({ spots: [{ id: "a", at: A }, { id: "b", at: [-1, 1, -1] }], H: 468, project: (p) => fixed(map)(p === A ? A : B) }));
    expect(out[1]).toMatchObject({ x: 18, y: 286, side: "l", pinned: true });
  });
});
