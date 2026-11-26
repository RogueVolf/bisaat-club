/* Room model in metres: 36 ft far wall (x 0..11), about 18 ft deep (z 0..5.5). Windows at x=11 and on the
   right third of the far wall. Door and reception on z=5.5. Ported verbatim from the reference page; the
   only change is that the vertex, caster and lamp lists are locals instead of globals. */

export type vec3 = [number, number, number];
type Col = readonly number[];

export interface RoomGeometry {
  /** 14 floats per vertex: position 3, normal 3, material 1, colour 3, uv 2, face size 2 */
  verts: Float32Array;
  /** shadow-casting boxes [min, max], padded to NB */
  casters: [vec3, vec3][];
  /** point lights [x, y, z, strength], padded to NL */
  lamps: [number, number, number, number][];
  NB: 64;
  NL: 16;
  STRIDE: 14;
  rawCasterCount: number;
  rawLampCount: number;
}

export const RW = 11, RD = 5.5, RH = 2.9;
export const M = { FLOOR: 0, SLAT: 1, PLASTER: 2, FABRIC: 3, WOOD: 4, SCREEN: 5, OUTSIDE: 6, BOOKS: 7, DARK: 8, GLOW: 9, BOARD: 10, SIGN: 13 } as const;

export function buildRoom(): RoomGeometry {
  const verts: number[] = [], casters: [vec3, vec3][] = [], LAMPS: [number, number, number, number][] = [];
  function box(a: vec3, b: vec3, mat: number, col: Col, cast?: boolean) {
    const x0 = a[0], y0 = a[1], z0 = a[2], x1 = b[0], y1 = b[1], z1 = b[2];
    const f = [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]]
    ];
    for (let i = 0; i < 6; i++) { const q = f[i], n = q[4], idx = [0, 1, 2, 0, 2, 3];
      const w = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]), h = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]), uv = [[0, 0], [w, 0], [w, h], [0, h]];
      for (let k = 0; k < 6; k++) { const p = q[idx[k]], t = uv[idx[k]]; verts.push(p[0], p[1], p[2], n[0], n[1], n[2], mat, col[0], col[1], col[2], t[0], t[1], w, h); } }
    if (cast) casters.push([a, b]);
  }
  function blob(c: vec3, r: vec3, mat: number, col: Col, cast?: boolean) {   // ellipsoid with smooth normals: bean bags, cushions, lamp shades
    const LA = 10, LO = 18, P = function (i: number, j: number) { const th = Math.PI * i / LA, ph = 2 * Math.PI * j / LO, s = Math.sin(th); return [s * Math.cos(ph), Math.cos(th), s * Math.sin(ph)]; };
    for (let i = 0; i < LA; i++) for (let j = 0; j < LO; j++) { const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j), P(i + 1, j + 1), P(i, j + 1)];
      for (let k = 0; k < 6; k++) { const d = q[k], nx = d[0] / r[0], ny = d[1] / r[1], nz = d[2] / r[2], l = Math.hypot(nx, ny, nz) || 1;
        verts.push(c[0] + d[0] * r[0], c[1] + d[1] * r[1], c[2] + d[2] * r[2], nx / l, ny / l, nz / l, mat, col[0], col[1], col[2], .5, .5, 1, 1); } }
    if (cast) casters.push([[c[0] - r[0] * .8, c[1] - r[1], c[2] - r[2] * .8], [c[0] + r[0] * .8, c[1] + r[1] * .8, c[2] + r[2] * .8]]);
  }
  const INK = [.122, .165, .267], WALNUT = [.353, .227, .141], AMBER = [.72, .5, .2], WOOD = [.569, .439, .353];
  const BEIGE = [.84, .77, .65], CEIL = [.9, .86, .78], BLK = [.06, .055, .05], WARM = [1, .74, .42];
  // Shell: slatted wood on the left and far walls, beige elsewhere, ink-blue sign wall in reception
  box([0, -.1, 0], [RW, 0, RD], M.FLOOR, WOOD);
  box([0, RH, 0], [RW, RH + .1, RD], M.PLASTER, CEIL);
  box([-.2, 0, 0], [0, RH, RD], M.SLAT, WOOD);
  box([0, 0, -.22], [7.3, RH, 0], M.SLAT, WOOD);
  box([7.3, 0, -.22], [RW, .75, 0], M.PLASTER, BEIGE); box([7.3, 2.45, -.22], [RW, RH, 0], M.PLASTER, BEIGE);
  [[7.3, 7.4], [8.48, 8.6], [9.68, 9.8], [10.88, 11]].forEach(function (s) { box([s[0], .75, -.14], [s[1], 2.45, 0], M.DARK, BLK); });
  box([7.4, 1.9, -.08], [10.88, 1.95, -.02], M.DARK, BLK);
  box([RW, 0, 0], [RW + .22, .75, RD], M.PLASTER, BEIGE); box([RW, 2.45, 0], [RW + .22, RH, RD], M.PLASTER, BEIGE);
  box([RW, .75, 0], [RW + .22, 2.45, .25], M.PLASTER, BEIGE); box([RW, .75, 5.13], [RW + .22, 2.45, RD], M.PLASTER, BEIGE);
  for (let k = 0; k < 3; k++) { const zk = .25 + 1.25 * k + 1.13; box([RW, .75, zk], [RW + .14, 2.45, zk + .12], M.DARK, BLK); }
  box([RW + .02, 1.9, .25], [RW + .08, 1.95, 5.13], M.DARK, BLK);
  box([RW - .1, .75, .25], [RW, .79, 5.13], M.WOOD, WOOD);
  box([RW + .9, -4, -8], [RW + 1, 10, 14], M.OUTSIDE, [1, 1, 1]); box([-8, -4, -1.0], [20, 10, -.9], M.OUTSIDE, [1, 1, 1]);
  box([0, 0, RD], [4.3, RH, RD + .2], M.PLASTER, BEIGE); box([4.3, 0, RD], [7.6, RH, RD + .2], M.SIGN, INK); box([7.6, 0, RD], [RW, RH, RD + .2], M.PLASTER, BEIGE);
  box([2.95, 0, RD - .04], [3.95, 2.12, RD], M.WOOD, WOOD); box([3.82, .98, RD - .07], [3.87, 1.08, RD - .04], M.DARK, [.6, .5, .3]);
  box([5.05, 0, 4.5], [6.75, 1.02, 4.92], M.WOOD, WALNUT, true); box([5.0, 1.02, 4.45], [6.8, 1.06, 4.97], M.WOOD, WOOD);
  // Lighting: hanging lights in three rows of two, tall floor lamps around the room, reading lamps on the tables
  [2.2, 5.5, 8.8].forEach(function (x) { [1.7, 3.8].forEach(function (z) {
    box([x - .006, 2.42, z - .006], [x + .006, RH, z + .006], M.DARK, BLK); box([x - .04, 2.4, z - .04], [x + .04, 2.44, z + .04], M.DARK, BLK);
    blob([x, 2.3, z], [.14, .11, .14], M.GLOW, WARM); LAMPS.push([x, 2.2, z, 2.6]); }); });
  function floorLamp(x: number, z: number) { box([x - .13, 0, z - .13], [x + .13, .03, z + .13], M.DARK, BLK); box([x - .012, .03, z - .012], [x + .012, 1.5, z + .012], M.DARK, BLK, true); blob([x, 1.74, z], [.13, .27, .13], M.GLOW, WARM); LAMPS.push([x, 1.7, z, 1.5]); }
  function deskLamp(x: number, y: number, z: number) { box([x - .06, y, z - .06], [x + .06, y + .015, z + .06], M.DARK, BLK); box([x - .008, y, z - .008], [x + .008, y + .27, z + .008], M.DARK, BLK); blob([x, y + .33, z], [.1, .085, .1], M.GLOW, WARM); LAMPS.push([x, y + .3, z, .55]); }
  floorLamp(.4, 2.45); floorLamp(.45, 5.1); floorLamp(6.75, .4); floorLamp(8.75, 5.1); floorLamp(10.6, 2.7);
  // Sim rigs against the far wall
  function rig(cx: number, stripe: Col) {
    box([cx - .4, 0, .3], [cx + .4, .06, 1.85], M.DARK, [.13, .12, .11]);
    box([cx - .26, .06, 1.15], [cx + .26, .34, 1.7], M.DARK, [.16, .15, .14], true);
    box([cx - .26, .34, 1.56], [cx + .26, 1.14, 1.74], M.FABRIC, [.17, .16, .15], true);
    box([cx - .07, .36, 1.553], [cx + .07, 1.12, 1.56], M.FABRIC, stripe); box([cx - .07, .36, 1.74], [cx + .07, 1.12, 1.747], M.FABRIC, stripe);
    box([cx - .3, .34, 1.2], [cx - .22, .5, 1.6], M.DARK, BLK); box([cx + .22, .34, 1.2], [cx + .3, .5, 1.6], M.DARK, BLK);
    box([cx - .06, .06, .64], [cx + .06, .8, .76], M.DARK, BLK);
    box([cx - .17, .74, .76], [cx + .17, .98, .81], M.DARK, [.09, .09, .09]);
    box([cx - .22, .06, .44], [cx + .22, .2, .6], M.DARK, [.2, .2, .2]);
    box([cx - .05, .06, .3], [cx + .05, .92, .36], M.DARK, BLK);
    box([cx - .64, .86, .3], [cx + .64, 1.5, .335], M.DARK, BLK, true);
    box([cx - .61, .89, .335], [cx + .61, 1.47, .34], M.SCREEN, [.3, .5, .85]);
  }
  rig(3.5, AMBER); rig(5.15, [.5, .14, .1]);
  // PS5 corner on the left wall: bean bags at one TV stand, a sofa at the other
  function tvStand(z0: number, screenCol: Col) {
    box([.04, 0, z0 + .1], [.46, .5, z0 + 1.4], M.WOOD, WALNUT, true);
    box([.2, .5, z0 + .62], [.32, .54, z0 + .88], M.DARK, BLK); box([.24, .54, z0 + .72], [.28, .62, z0 + .78], M.DARK, BLK);
    box([.23, .6, z0 + .18], [.28, 1.26, z0 + 1.32], M.DARK, BLK, true);
    box([.28, .63, z0 + .21], [.285, 1.23, z0 + 1.29], M.SCREEN, screenCol);
    box([.12, .5, z0 + .2], [.22, .76, z0 + .27], M.PLASTER, [.93, .93, .93]);
  }
  tvStand(.45, [.3, .6, .35]);
  blob([1.75, .3, .75], [.46, .32, .44], M.FABRIC, AMBER, true);  blob([1.98, .52, .75], [.3, .3, .36], M.FABRIC, AMBER);
  blob([1.95, .3, 1.65], [.46, .32, .44], M.FABRIC, [.24, .3, .42], true); blob([2.18, .52, 1.65], [.3, .3, .36], M.FABRIC, [.24, .3, .42]);
  blob([1.3, .28, 1.2], [.4, .28, .4], M.FABRIC, [.72, .66, .55], true);
  tvStand(3.0, [.7, .45, .3]);
  box([1.0, 0, 3.42], [1.42, .36, 4.08], M.WOOD, WALNUT, true);
  box([1.1, .36, 3.5], [1.22, .4, 3.6], M.PLASTER, [.9, .9, .9]); box([1.2, .36, 3.85], [1.32, .4, 3.95], M.PLASTER, [.9, .9, .9]);
  const SOFA = [.3, .36, .47], SOFA2 = [.26, .31, .41], SOFA3 = [.35, .41, .52];
  box([1.72, 0, 3.0], [2.32, .4, 4.5], M.FABRIC, SOFA, true); box([2.26, 0, 3.0], [2.48, .86, 4.5], M.FABRIC, SOFA2, true);
  box([1.72, 0, 3.0], [2.48, .6, 3.16], M.FABRIC, SOFA2); box([1.72, 0, 4.34], [2.48, .6, 4.5], M.FABRIC, SOFA2);
  blob([1.99, .43, 3.47], [.27, .1, .3], M.FABRIC, SOFA3); blob([1.99, .43, 4.03], [.27, .1, .3], M.FABRIC, SOFA3);
  blob([2.24, .66, 3.47], [.1, .2, .29], M.FABRIC, SOFA3); blob([2.24, .66, 4.03], [.1, .2, .29], M.FABRIC, SOFA3);
  // Chairs and tables
  function chairX(cx: number, cz: number, dir: number) { const bx = cx - dir * .2;   // dir +1: sitter faces +x
    box([cx - .2, .4, cz - .2], [cx + .2, .45, cz + .2], M.WOOD, WOOD, true); blob([cx, .46, cz], [.18, .035, .18], M.FABRIC, [.78, .72, .6]);
    box([Math.min(bx, bx - dir * .035), .45, cz - .2], [Math.max(bx, bx - dir * .035), .92, cz + .2], M.WOOD, WOOD, true);
    [[-.2, -.2], [.17, -.2], [-.2, .17], [.17, .17]].forEach(function (o) { box([cx + o[0], 0, cz + o[1]], [cx + o[0] + .03, .4, cz + o[1] + .03], M.WOOD, WOOD); }); }
  function chairZ(cx: number, cz: number, dir: number) { const bz = cz - dir * .2;
    box([cx - .2, .4, cz - .2], [cx + .2, .45, cz + .2], M.WOOD, WOOD, true); blob([cx, .46, cz], [.18, .035, .18], M.FABRIC, [.78, .72, .6]);
    box([cx - .2, .45, Math.min(bz, bz - dir * .035)], [cx + .2, .92, Math.max(bz, bz - dir * .035)], M.WOOD, WOOD, true);
    [[-.2, -.2], [.17, -.2], [-.2, .17], [.17, .17]].forEach(function (o) { box([cx + o[0], 0, cz + o[1]], [cx + o[0] + .03, .4, cz + o[1] + .03], M.WOOD, WOOD); }); }
  function table(x0: number, z0: number, x1: number, z1: number) { box([x0, .71, z0], [x1, .75, z1], M.WOOD, WALNUT, true);
    [[x0 + .04, z0 + .04], [x1 - .1, z0 + .04], [x0 + .04, z1 - .1], [x1 - .1, z1 - .1]].forEach(function (p) { box([p[0], 0, p[1]], [p[0] + .06, .71, p[1] + .06], M.WOOD, WALNUT); }); }
  // Board games in the middle of the room
  table(5.6, 2.9, 6.5, 3.8); chairX(5.55, 3.35, 1); chairX(6.55, 3.35, -1); chairZ(6.05, 2.85, 1); chairZ(6.05, 3.85, -1); deskLamp(5.77, .75, 3.07);
  box([5.87, .75, 3.17], [6.27, .765, 3.57], M.BOARD, [1, 1, 1]);
  table(7.2, 2.0, 8.35, 2.7); chairZ(7.5, 1.95, 1); chairZ(8.05, 1.95, 1); chairZ(7.5, 2.75, -1); chairZ(8.05, 2.75, -1); deskLamp(8.2, .75, 2.13);
  box([7.4, .75, 2.15], [7.75, .82, 2.4], M.FABRIC, [.5, .17, .12]); box([7.85, .75, 2.45], [7.93, .755, 2.57], M.PLASTER, [.95, .93, .88]); box([7.96, .75, 2.43], [8.04, .755, 2.55], M.PLASTER, [.95, .93, .88]);
  // Reading room by the window wall: a bookshelf at each end, reading tables between
  box([9.1, 0, .05], [10.9, 2.1, .43], M.BOOKS, WALNUT, true);
  box([9.1, 0, 5.07], [10.9, 2.1, 5.45], M.BOOKS, WALNUT, true);
  table(9.3, 1.0, 10.3, 2.2); chairX(9.25, 1.3, 1); chairX(9.25, 1.9, 1); chairX(10.35, 1.3, -1); chairX(10.35, 1.9, -1); deskLamp(9.8, .75, 1.6);
  box([9.45, .75, 1.15], [9.67, .78, 1.31], M.FABRIC, [.45, .2, .16]); box([9.9, .75, 1.85], [10.1, .775, 2.0], M.FABRIC, [.2, .27, .36]); box([9.92, .775, 1.86], [10.1, .8, 2.0], M.FABRIC, [.82, .76, .62]);
  table(9.3, 3.2, 10.3, 4.4); chairX(9.25, 3.5, 1); chairX(9.25, 4.1, 1); chairX(10.35, 3.5, -1); chairX(10.35, 4.1, -1); deskLamp(9.8, .75, 3.8);
  box([9.47, .75, 4.05], [9.69, .78, 4.2], M.FABRIC, [.22, .33, .28]); box([9.95, .75, 3.35], [10.15, .775, 3.5], M.FABRIC, [.7, .55, .25]);
  const NB = 64, NL = 16;
  const rawCasterCount = casters.length, rawLampCount = LAMPS.length;
  if (casters.length > NB || LAMPS.length > NL) console.warn('raise NB/NL', casters.length, LAMPS.length);
  while (casters.length < NB) casters.push([[90, 90, 90], [90, 90, 90]]);
  while (LAMPS.length < NL) LAMPS.push([0, -50, 0, 0]);
  return { verts: new Float32Array(verts), casters, lamps: LAMPS, NB, NL, STRIDE: 14, rawCasterCount, rawLampCount };
}
