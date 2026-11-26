import { describe, expect, it } from "vitest";
import { buildViewProjection, EYE, projectPoint } from "@/walkthrough/math";
import { SEED } from "@/content/seed";

/* Oracle: the reference updateMatrices / project, ported line for line with its globals as arguments. */
function referencePV(cam: { x: number; z: number; yaw: number; pitch: number; bob: number }, look: { yaw: number; pitch: number }, W: number, H: number) {
  const RAD = Math.PI / 180;
  function mul(a: Float32Array, b: Float32Array) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  }
  const yaw = (cam.yaw + look.yaw) * RAD, pitch = (cam.pitch + look.pitch) * RAD, cp = Math.cos(pitch);
  const f = [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp], r = [Math.cos(yaw), 0, Math.sin(yaw)];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const e = [cam.x, 1.56 + cam.bob, cam.z];
  const Vm = new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -(r[0] * e[0] + r[1] * e[1] + r[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), (f[0] * e[0] + f[1] * e[1] + f[2] * e[2]), 1]);
  const fov = (W < H ? 72 : 56) * RAD, t = 1 / Math.tan(fov / 2), n = .05, fr = 80;
  const P = new Float32Array([t / (W / H), 0, 0, 0, 0, t, 0, 0, 0, 0, (fr + n) / (n - fr), -1, 0, 0, 2 * fr * n / (n - fr), 0]);
  return mul(P, Vm);
}
function referenceProject(PV: Float32Array, p: number[], W: number, H: number): [number, number] | null {
  const x = PV[0] * p[0] + PV[4] * p[1] + PV[8] * p[2] + PV[12], y = PV[1] * p[0] + PV[5] * p[1] + PV[9] * p[2] + PV[13], w = PV[3] * p[0] + PV[7] * p[1] + PV[11] * p[2] + PV[15];
  if (w <= .2) return null;
  return [(x / w * .5 + .5) * W, (1 - (y / w * .5 + .5)) * H];
}

const zone = (id: string) => SEED.zones.find((z) => z.id === id)!;
// 390x844 phone: header 58 px, sheet about 318 px tall (overlapping the view by 22 px) -> view about 390x468
const W = 390, H = 844 - 58 - 318;

describe("buildViewProjection", () => {
  it("uses eye height 1.56", () => {
    expect(EYE).toBe(1.56);
  });

  it("matches the reference matrix for the door camera", () => {
    const door = zone("door");
    const cam = { x: door.cam[0], z: door.cam[1], eyeY: EYE, yaw: door.yaw, pitch: door.pitch };
    const pv = buildViewProjection(cam, W, H);
    const ref = referencePV({ x: door.cam[0], z: door.cam[1], yaw: door.yaw, pitch: door.pitch, bob: 0 }, { yaw: 0, pitch: 0 }, W, H);
    expect(Array.from(pv)).toEqual(Array.from(ref));
  });

  it("projects the ps5 hotspot to the reference pixel from the door", () => {
    const door = zone("door");
    const at = zone("ps5").at!;
    const pv = buildViewProjection({ x: door.cam[0], z: door.cam[1], eyeY: EYE, yaw: door.yaw, pitch: door.pitch }, W, H);
    const ref = referenceProject(referencePV({ x: door.cam[0], z: door.cam[1], yaw: door.yaw, pitch: door.pitch, bob: 0 }, { yaw: 0, pitch: 0 }, W, H), at, W, H);
    const got = projectPoint(pv, at, W, H);
    expect(ref).not.toBeNull();
    expect(got).toEqual(ref);
  });

  it("matches the reference with a look offset, bob and landscape aspect", () => {
    const lib = zone("lib");
    const look = { yaw: -31, pitch: 12 };
    const bob = 0.013;
    const pv = buildViewProjection({ x: lib.cam[0], z: lib.cam[1], eyeY: EYE + bob, yaw: lib.yaw + look.yaw, pitch: lib.pitch + look.pitch }, 1280, 720);
    const ref = referencePV({ x: lib.cam[0], z: lib.cam[1], yaw: lib.yaw, pitch: lib.pitch, bob }, look, 1280, 720);
    for (let i = 0; i < 16; i++) expect(pv[i]).toBeCloseTo(ref[i], 5);
    const p = zone("games").at!;
    const a = projectPoint(pv, p, 1280, 720), b = referenceProject(ref, p, 1280, 720);
    expect(a![0]).toBeCloseTo(b![0], 2);
    expect(a![1]).toBeCloseTo(b![1], 2);
  });

  it("returns null behind the camera (w <= 0.2)", () => {
    const door = zone("door");
    const pv = buildViewProjection({ x: door.cam[0], z: door.cam[1], eyeY: EYE, yaw: door.yaw, pitch: door.pitch }, W, H);
    // a point directly behind the door camera
    const behind: [number, number, number] = [door.cam[0] - Math.sin(30 * Math.PI / 180) * 2, 1.5, door.cam[1] + Math.cos(30 * Math.PI / 180) * 2];
    expect(projectPoint(pv, behind, W, H)).toBeNull();
  });
});
