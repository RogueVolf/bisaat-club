import { describe, expect, it } from "vitest";
import { buildRoom } from "@/scene/procedural/geometry";

describe("buildRoom", () => {
  const room = buildRoom();

  it("emits whole vertices of 14 floats", () => {
    expect(room.STRIDE).toBe(14);
    expect(room.verts.length % 14).toBe(0);
    expect(room.verts.length).toBeGreaterThan(0);
  });

  it("pads casters to NB = 64 and lamps to NL = 16", () => {
    expect(room.NB).toBe(64);
    expect(room.NL).toBe(16);
    expect(room.casters.length).toBe(64);
    expect(room.lamps.length).toBe(16);
  });

  it("has raw counts within the shader array sizes", () => {
    expect(room.rawCasterCount).toBeGreaterThan(0);
    expect(room.rawCasterCount).toBeLessThanOrEqual(64);
    expect(room.rawLampCount).toBeGreaterThan(0);
    expect(room.rawLampCount).toBeLessThanOrEqual(16);
  });

  it("pads with the reference sentinels", () => {
    expect(room.casters[63]).toEqual([[90, 90, 90], [90, 90, 90]]);
    expect(room.lamps[15]).toEqual([0, -50, 0, 0]);
  });

  it("starts with the reference floor box first vertex", () => {
    const first = Array.from(room.verts.slice(0, 14));
    const expected = [0, -0.1, 5.5, 0, 0, 1, 0, 0.569, 0.439, 0.353, 0, 0, 11, 0.1];
    expected.forEach((v, i) => expect(first[i]).toBeCloseTo(v, 6));
  });

  it("is pure: two builds are identical", () => {
    const again = buildRoom();
    expect(again.verts.length).toBe(room.verts.length);
    expect(again.rawCasterCount).toBe(room.rawCasterCount);
    expect(Array.from(again.verts.slice(-14))).toEqual(Array.from(room.verts.slice(-14)));
  });
});
