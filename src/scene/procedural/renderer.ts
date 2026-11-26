import type { CameraState, RoomRenderer } from "@/scene/types";
import { buildViewProjection, projectPoint } from "@/walkthrough/math";
import { buildRoom } from "./geometry";
import { VS, fragmentShader } from "./shader";

/** The reference procedural room: WebGL 1, one static vertex buffer, one fragment shader. */
export function createProceduralRenderer(): RoomRenderer {
  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGLRenderingContext | null = null;
  let prog: WebGLProgram | null = null, buf: WebGLBuffer | null = null, tex: WebGLTexture | null = null;
  const shaders: WebGLShader[] = [];
  let uPV: WebGLUniformLocation | null = null, uEye: WebGLUniformLocation | null = null, uRes: WebGLUniformLocation | null = null, uDay: WebGLUniformLocation | null = null;
  let count = 0, W = 1, H = 1, PV = new Float32Array(16), last: CameraState | null = null;
  let logo: HTMLImageElement | null = null;

  return {
    init(c, opts) {
      canvas = c;
      const g = c.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
      if (!g) return false;
      gl = g;
      let ok = true;
      const room = buildRoom();
      const sh = (type: number, src: string) => { const s = g.createShader(type)!; g.shaderSource(s, src); g.compileShader(s);
        if (!g.getShaderParameter(s, g.COMPILE_STATUS)) { console.error(g.getShaderInfoLog(s)); ok = false; } shaders.push(s); return s; };
      prog = g.createProgram(); g.attachShader(prog, sh(g.VERTEX_SHADER, VS)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, fragmentShader(room.NB, room.NL))); g.linkProgram(prog);
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) { console.error(g.getProgramInfoLog(prog)); ok = false; }
      if (!ok) return false;
      g.useProgram(prog);
      buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, room.verts, g.STATIC_DRAW);
      const p = prog;
      ([['aP', 3, 0], ['aN', 3, 12], ['aM', 1, 24], ['aC', 3, 28], ['aU', 4, 40]] as const).forEach(function (a) { const l = g.getAttribLocation(p, a[0]); g.enableVertexAttribArray(l); g.vertexAttribPointer(l, a[1], g.FLOAT, false, 56, a[2]); });
      uPV = g.getUniformLocation(prog, 'uPV'); uEye = g.getUniformLocation(prog, 'uEye'); uRes = g.getUniformLocation(prog, 'uRes'); uDay = g.getUniformLocation(prog, 'uDay');
      const mn: number[] = [], mx: number[] = [], lp: number[] = []; room.casters.forEach(function (c) { mn.push(c[0][0], c[0][1], c[0][2]); mx.push(c[1][0], c[1][1], c[1][2]); }); room.lamps.forEach(function (l) { lp.push(l[0], l[1], l[2], l[3]); });
      g.uniform3fv(g.getUniformLocation(prog, 'uBmin'), new Float32Array(mn)); g.uniform3fv(g.getUniformLocation(prog, 'uBmax'), new Float32Array(mx)); g.uniform4fv(g.getUniformLocation(prog, 'uLamp'), new Float32Array(lp));
      count = room.verts.length / room.STRIDE;
      // The sign on the ink-blue reception wall uses the same logo image as the header
      const t = g.createTexture(); tex = t; g.bindTexture(g.TEXTURE_2D, t);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([243, 235, 221, 0]));
      g.uniform1i(g.getUniformLocation(prog, 'uLogo'), 0);
      const img = new Image(); logo = img;
      img.onload = function () { if (gl !== g || logo !== img) return; g.bindTexture(g.TEXTURE_2D, t); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img); g.generateMipmap(g.TEXTURE_2D);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); opts.onNeedsRender(); };
      img.src = opts.logoUrl;
      g.enable(g.DEPTH_TEST);
      return true;
    },

    resize(cssW, cssH, pixelRatio) {
      W = cssW; H = cssH;
      if (canvas) { const cw = Math.max(2, Math.round(W * pixelRatio)), ch = Math.max(2, Math.round(H * pixelRatio)); if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; } }
      if (last) PV = buildViewProjection(last, W, H);
    },

    render(camera, day) {
      last = camera;
      PV = buildViewProjection(camera, W, H);
      if (!gl || !canvas) return;
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(.05, .03, .02, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uPV, false, PV); gl.uniform3f(uEye, camera.x, camera.eyeY, camera.z); gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uDay, day);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    },

    project(p) {
      return projectPoint(PV, p, W, H);
    },

    dispose() {
      if (logo) { logo.onload = null; logo = null; }
      if (gl) {
        if (buf) gl.deleteBuffer(buf);
        if (tex) gl.deleteTexture(tex);
        shaders.forEach((s) => gl!.deleteShader(s));
        if (prog) gl.deleteProgram(prog);
      }
      shaders.length = 0; buf = tex = prog = null; gl = null; canvas = null; last = null;
    },
  };
}
