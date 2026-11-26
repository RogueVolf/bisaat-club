import type { CameraState } from "@/scene/types";

/** Eye height in metres (reference EYE). */
export const EYE = 1.56;
const RAD = Math.PI / 180;

function mul(a: Float32Array, b: Float32Array): Float32Array<ArrayBuffer> {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}

/**
 * Projection × view, column-major (reference updateMatrices). fov 72° when the view is
 * portrait, 56° otherwise; near 0.05, far 80. `camera.yaw`/`pitch` already include the
 * drag offset and `camera.eyeY` already includes the bob.
 */
export function buildViewProjection(camera: CameraState, W: number, H: number): Float32Array<ArrayBuffer> {
  const yaw = camera.yaw * RAD, pitch = camera.pitch * RAD, cp = Math.cos(pitch);
  const f = [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp], r = [Math.cos(yaw), 0, Math.sin(yaw)];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const e = [camera.x, camera.eyeY, camera.z];
  const Vm = new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -(r[0] * e[0] + r[1] * e[1] + r[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), (f[0] * e[0] + f[1] * e[1] + f[2] * e[2]), 1]);
  const fov = (W < H ? 72 : 56) * RAD, t = 1 / Math.tan(fov / 2), n = .05, fr = 80;
  const P = new Float32Array([t / (W / H), 0, 0, 0, 0, t, 0, 0, 0, 0, (fr + n) / (n - fr), -1, 0, 0, 2 * fr * n / (n - fr), 0]);
  return mul(P, Vm);
}

/** World point → CSS px for a W×H view, or null when w <= 0.2 (reference project). */
export function projectPoint(PV: Float32Array, p: readonly number[], W: number, H: number): [number, number] | null {
  const x = PV[0] * p[0] + PV[4] * p[1] + PV[8] * p[2] + PV[12], y = PV[1] * p[0] + PV[5] * p[1] + PV[9] * p[2] + PV[13], w = PV[3] * p[0] + PV[7] * p[1] + PV[11] * p[2] + PV[15];
  if (w <= .2) return null;
  return [(x / w * .5 + .5) * W, (1 - (y / w * .5 + .5)) * H];
}
