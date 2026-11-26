type Vec3 = [number, number, number];

export interface HotspotInput {
  spots: { id: string; at: Vec3 }[];
  current: string;
  walking: boolean;
  W: number;
  H: number;
  camX: number;
  camZ: number;
  /** cam.yaw + look.yaw, degrees */
  yawNow: number;
  project: (p: Vec3) => [number, number] | null;
}

export interface HotspotPlacement {
  id: string;
  hidden: boolean;
  x: number;
  y: number;
  side: "l" | "r";
  /** true when pinned to a view edge (off-screen or under the desktop sheet) */
  pinned: boolean;
}

const RAD = Math.PI / 180;

/** Reference hotspot placement, in spot order. Hidden entries carry x = y = 0 and are not positioned. */
export function placeHotspots(input: HotspotInput): HotspotPlacement[] {
  const { spots, current, walking, W, H, camX, camZ, yawNow, project } = input;
  const placed: [number, number][] = [];
  let nl = 0, nr = 0;
  const desk = (W >= 860 && H >= 521);
  return spots.map(({ id, at: a }) => {
    if (id === current && !walking) return { id, hidden: true, x: 0, y: 0, side: "l", pinned: false };
    const p = project(a);
    const on = p && p[0] >= 14 && p[0] <= W - 120 && p[1] >= 30 && p[1] <= H - 50 && !(desk && p[0] < 460 && p[1] > H - 340);
    if (on && p) {
      for (let i = 0; i < placed.length; i++) { if (Math.abs(placed[i][0] - p[0]) < 150 && Math.abs(placed[i][1] - p[1]) < 44) { p[1] = placed[i][1] + (p[1] >= placed[i][1] ? 46 : -46); } }
      placed.push(p);
      return { id, hidden: false, x: p[0], y: p[1], side: "l", pinned: false };
    }
    let b = Math.atan2(a[0] - camX, -(a[2] - camZ)) / RAD - yawNow; b = ((b + 540) % 360) - 180;
    const left = (b < 0 && !desk), x = left ? 18 : W - 10;
    let y = H * .5 + 46 * (left ? nl++ : nr++);
    for (let i = 0; i < placed.length; i++) { if (Math.abs(placed[i][0] - (left ? x : x - 130)) < 170 && Math.abs(placed[i][1] - y) < 40) { y = placed[i][1] + 46; if (left) nl++; else nr++; } }
    placed.push([left ? x : x - 130, y]);
    return { id, hidden: false, x, y, side: left ? "l" : "r", pinned: true };
  });
}
