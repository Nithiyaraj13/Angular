import {
  Geo,
  ellipsoid,
  lathe,
  latheFn,
  LatheOpts,
  mergeGeo,
  parametric,
  smooth,
  spline,
  superquadric,
  transformGeo,
  tube,
} from './geometry';
import {
  Mat4,
  V3,
  identity,
  jointMatrix,
  lookAt,
  multiply,
  perspective,
  rotX,
  rotY,
  rotZ,
  transformPoint,
  translation,
} from './gl-math';
import { HAIRLINE, chestTex, faceTex, fabricTile, leatherTex, trouserTex, waistTex } from './textures';

/** CSS size of the canvas at scale 1. */
export const CANVAS_W = 300;
export const CANVAS_H = 440;
export const FLIGHT_MS = 1150;

// ---------------------------------------------------------------------------------------------
// Shaders: warm key + cool fill + amber rim (battlefield fires), wrap lighting for skin,
// strand sheen for hair, additive emissive for jet flames. Lighting is done in linear space.
// ---------------------------------------------------------------------------------------------
const VERT = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUv;
uniform mat4 uModel; uniform mat4 uVP;
varying vec3 vN; varying vec3 vP; varying vec2 vUv;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vP = w.xyz; vN = (uModel * vec4(aNrm, 0.0)).xyz; vUv = aUv;
  gl_Position = uVP * w;
}`;

const FRAG = `
precision mediump float;
varying vec3 vN; varying vec3 vP; varying vec2 vUv;
uniform vec3 uColor; uniform float uSpec; uniform float uShine; uniform float uMode; uniform float uRefl; uniform float uMetal;
uniform float uTexMode; uniform sampler2D uTex; uniform vec2 uTexScale; uniform vec3 uCam; uniform float uAlpha;
uniform float uShadow; uniform float uScanY; uniform float uScanAmt; uniform float uScanClip;

// Studio + battlefield environment for reflections: dark floor, cool sky, key softbox, fire glow.
vec3 envMap(vec3 R) {
  vec3 c = mix(vec3(0.05, 0.04, 0.035), vec3(0.3, 0.32, 0.36), smoothstep(-0.25, 0.65, R.y));
  c += vec3(1.0, 0.62, 0.28) * 0.9 * pow(max(0.0, dot(R, normalize(vec3(-0.65, 0.1, 0.75)))), 18.0);
  c += vec3(1.0, 0.97, 0.92) * 1.4 * pow(max(0.0, dot(R, normalize(vec3(-0.45, 0.75, 0.65)))), 90.0);
  c += vec3(0.5, 0.65, 1.0) * 0.4 * pow(max(0.0, dot(R, normalize(vec3(0.85, 0.2, 0.35)))), 40.0);
  return c;
}

void main() {
  if (uScanClip > 0.5 && vP.y > uScanY + 0.8) discard;
  if (uShadow > 0.5) {
    float a = 0.45 * uAlpha * (1.0 - smoothstep(14.0, 80.0, length(vP.xz)));
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }
  if (uMode > 2.5 && uMode < 3.5) {
    float v = vUv.y;
    vec3 c = mix(vec3(1.0, 0.28, 0.04), vec3(1.0, 0.93, 0.7), v * v);
    float a = smoothstep(0.0, 0.75, v) * uAlpha;
    gl_FragColor = vec4(c * a, a);
    return;
  }
  vec3 base = uColor;
  if (uTexMode > 0.5) {
    vec3 t = texture2D(uTex, vUv * uTexScale).rgb;
    base = uTexMode < 1.5 ? t : base * t * 2.0;
  }
  vec3 alb = pow(base, vec3(2.2));
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCam - vP);
  vec3 L1 = normalize(vec3(-0.45, 0.75, 0.65));
  vec3 L2 = normalize(vec3(0.85, 0.2, 0.35));
  vec3 L3 = normalize(vec3(0.4, 0.45, -0.9));
  bool skin = uMode > 0.5 && uMode < 1.5;
  bool fabric = uMode > 3.5;
  float w = skin ? 0.4 : 0.1;
  float nv = max(dot(N, V), 0.0);
  float d1 = max(0.0, (dot(N, L1) + w) / (1.0 + w));
  float d2 = max(0.0, dot(N, L2));
  // Cheap ambient occlusion: creases facing down and away from the camera get less ambient light.
  float ao = mix(0.55, 1.0, smoothstep(-0.6, 0.5, N.y * 0.5 + nv * 0.6));
  vec3 hemi = mix(vec3(0.09, 0.065, 0.05), vec3(0.24, 0.26, 0.29), N.y * 0.5 + 0.5) * ao;
  vec3 col = alb * (hemi + d1 * vec3(1.3, 1.18, 1.02) + d2 * vec3(0.22, 0.3, 0.45));
  if (skin) col += alb * vec3(0.22, 0.06, 0.03) * (1.0 - d1);
  if (fabric) col += alb * vec3(0.55, 0.62, 0.8) * pow(1.0 - nv, 2.0) * 0.9;
  vec3 H = normalize(L1 + V);
  float s = pow(max(dot(N, H), 0.0), uShine) * uSpec;
  if (uMode > 1.5 && uMode < 2.5) {
    float strand = 0.8 + 0.2 * sin(vUv.x * 420.0 + sin(vUv.y * 23.0) * 2.5);
    float root = 0.55 + 0.45 * smoothstep(0.0, 0.25, vUv.y); // softer hairline
    col *= strand * root;
    s *= strand * 1.6 * root;
  }
  col += s * mix(vec3(1.0, 0.95, 0.86), alb * 2.5, uMetal);
  vec3 env = envMap(reflect(-V, N));
  float f5 = pow(1.0 - nv, 5.0);
  col += env * uRefl * mix(0.06 + 0.94 * f5, 1.0, uMetal) * mix(vec3(1.0), alb * 2.2, uMetal);
  float fres = pow(1.0 - nv, 3.0);
  float sideMask = 1.0 - smoothstep(0.2, 0.7, abs(N.y));
  col += fres * sideMask * max(0.0, dot(N, L3) + 0.3) * vec3(1.0, 0.52, 0.16) * 0.7;
  // Holographic deploy scan.
  float band = exp(-pow((vP.y - uScanY) / 2.2, 2.0));
  float grid = step(0.88, fract(vP.y * 0.35)) * smoothstep(uScanY - 60.0, uScanY, vP.y);
  col += vec3(1.0, 0.6, 0.15) * (band * 2.5 + grid * 0.35) * uScanAmt;
  col = col / (col + vec3(0.82)) * 1.62;
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

/** Soft round point sprites for sparks, motes and landing dust (premultiplied; alpha 0 = additive). */
const PVERT = `
attribute vec3 aPos; attribute vec4 aCol; attribute float aSize;
uniform mat4 uVP; uniform float uPx;
varying vec4 vCol;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  gl_PointSize = aSize * uPx / gl_Position.w;
  vCol = aCol;
}`;
const PFRAG = `
precision mediump float;
varying vec4 vCol; uniform float uAdd;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.15, 1.0, d)) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, uAdd > 0.5 ? 0.0 : a);
}`;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  /** 0 spark, 1 mote (both additive), 2 dust (alpha). */
  kind: 0 | 1 | 2;
}
const MAX_PARTICLES = 420;

interface Material {
  color: V3;
  spec: number;
  shine: number;
  mode?: number; // 0 standard, 1 skin, 2 hair, 3 emissive
  tex?: string;
  texMode?: number; // 1 albedo, 2 detail multiply
  texScale?: [number, number];
  /** Environment reflection strength. */
  refl?: number;
  metal?: boolean;
}

const hex = (h: string): V3 => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

const MAT: Record<string, Material> = {
  skin: { color: hex('#9a6342'), spec: 0.2, shine: 22, mode: 1, refl: 0.05 },
  face: { color: hex('#a26a47'), spec: 0.22, shine: 24, mode: 1, tex: 'face', texMode: 1, refl: 0.06 },
  lid: { color: hex('#935e3e'), spec: 0.18, shine: 20, mode: 1, refl: 0.05 },
  hair: { color: hex('#17110d'), spec: 0.32, shine: 26, mode: 2, refl: 0.12 },
  sleeve: { color: hex('#1f2838'), spec: 0.1, shine: 14, mode: 4, tex: 'fabric', texMode: 2, texScale: [3, 5], refl: 0.05 },
  chest: { color: hex('#1f2838'), spec: 0.1, shine: 14, mode: 4, tex: 'chest', texMode: 1, refl: 0.05 },
  waist: { color: hex('#1f2838'), spec: 0.1, shine: 14, mode: 4, tex: 'waist', texMode: 1, refl: 0.05 },
  trouser: { color: hex('#1b2230'), spec: 0.08, shine: 12, mode: 4, tex: 'trouser', texMode: 1, refl: 0.04 },
  shirt: { color: hex('#e9eef4'), spec: 0.25, shine: 30, refl: 0.08 },
  tie: { color: hex('#6d1c24'), spec: 0.4, shine: 48, refl: 0.15 },
  sclera: { color: hex('#ece4dc'), spec: 0.8, shine: 90, refl: 0.5 },
  iris: { color: hex('#3b2416'), spec: 0.6, shine: 90, refl: 0.4 },
  pupil: { color: hex('#060404'), spec: 1, shine: 140, refl: 0.6 },
  shoe: { color: hex('#0d0e11'), spec: 1.25, shine: 110, refl: 0.9 },
  sole: { color: hex('#1a120c'), spec: 0.2, shine: 20, refl: 0.05 },
  leather: { color: hex('#4b3220'), spec: 0.38, shine: 34, tex: 'leather', texMode: 2, texScale: [2, 2], refl: 0.25 },
  flap: { color: hex('#3a2619'), spec: 0.38, shine: 34, tex: 'leather', texMode: 2, texScale: [2, 1], refl: 0.25 },
  strap: { color: hex('#28190f'), spec: 0.3, shine: 30, refl: 0.15 },
  metal: { color: hex('#d3b46a'), spec: 1.4, shine: 120, refl: 1, metal: true },
  flame: { color: [1, 1, 1], spec: 0, shine: 1, mode: 3 },
};

// ---------------------------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------------------------
interface Node {
  name: string;
  t: V3;
  r: V3;
  s?: V3;
  /** Hangs under gravity (briefcase): takes parent position but only the body's yaw. */
  hang?: boolean;
  parent?: Node;
  children: Node[];
  world: Mat4;
}

interface Mesh {
  node: Node;
  mat: Material;
  count: number;
  buf: { pos: WebGLBuffer; nrm: WebGLBuffer; uv: WebGLBuffer; idx: WebGLBuffer };
}

type Pose = Record<string, V3>;
interface Extras {
  hipX: number;
  hipY: number;
  curlL: number;
  curlR: number;
  thumbL: number;
  thumbR: number;
}

const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR'];
const FINGERS = [
  { z: 2.75, a: 4.3, b: 3.6, r: 0.82 },
  { z: 0.95, a: 4.7, b: 3.9, r: 0.85 },
  { z: -0.85, a: 4.4, b: 3.6, r: 0.8 },
  { z: -2.55, a: 3.6, b: 3.0, r: 0.7 },
];

type GestureName = 'salute' | 'wave' | 'tie' | 'thumbs';
const GESTURE_MS: Record<GestureName, number> = { salute: 2600, wave: 3300, tie: 2800, thumbs: 2400 };
const GESTURE_ORDER: GestureName[] = ['salute', 'wave', 'thumbs', 'tie'];

const env = (g: number, a = 0.16, b = 0.84) => smooth(0, a, g) * (1 - smooth(b, 1, g));
const win = (t: number, a: number, b: number, c: number, d: number) => smooth(a, b, t) * (1 - smooth(c, d, t));
const lerp = (a: number, b: number, w: number) => a + (b - a) * w;

// ---------------------------------------------------------------------------------------------
// Body shapes (cm, feet on the ground at y = 0, facing +Z)
// ---------------------------------------------------------------------------------------------
const g = (x: number, s: number) => Math.exp(-(x * x) / (s * s));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const noseAmp = spline([[0.3, 0], [0.35, 1.0], [0.39, 2.4], [0.43, 2.0], [0.5, 1.1], [0.6, 0.55], [0.66, 0]]);

const HEAD: LatheOpts = {
  y0: -2,
  y1: 22,
  rx: spline([[0, 0], [0.03, 3.4], [0.12, 5.4], [0.3, 7.0], [0.5, 7.6], [0.7, 7.7], [0.85, 7.0], [0.95, 4.6], [1, 0]]),
  rz: spline([[0, 0], [0.03, 4.6], [0.15, 7.8], [0.3, 8.6], [0.5, 8.9], [0.7, 8.7], [0.85, 7.6], [0.95, 5.0], [1, 0]]),
  rzBack: spline([[0, 0], [0.03, 2.2], [0.15, 5.2], [0.3, 8.0], [0.5, 9.8], [0.7, 10.2], [0.85, 9.2], [0.95, 6.2], [1, 0]]),
  n: 2.2,
  disp: (theta, t) => {
    const d = wrap(theta - Math.PI / 2);
    const nose = noseAmp(t) * g(d, 0.075 + 0.045 * (1 - smooth(0.36, 0.5, t)));
    const brow = 0.7 * g(t - 0.635, 0.035) * g(d, 0.55);
    const sockets = -0.9 * g(t - 0.56, 0.04) * (g(d - 0.33, 0.13) + g(d + 0.33, 0.13));
    const lips = 0.3 * g(t - 0.215, 0.035) * g(d, 0.22);
    const chin = 0.9 * g(t - 0.07, 0.05) * g(d, 0.3);
    const cheeks = 0.45 * g(t - 0.47, 0.06) * (g(d - 0.7, 0.2) + g(d + 0.7, 0.2));
    return nose + brow + sockets + lips + chin + cheeks;
  },
  nu: 72,
  nv: 56,
};
const headFn = latheFn(HEAD);

function hairGeo(): Geo {
  return parametric(
    (u, v) => {
      const theta = u * Math.PI * 2;
      const t0 = HAIRLINE(theta);
      const t = t0 + (1 - t0) * Math.min(1, Math.max(0, v));
      const p = headFn(u, t);
      const k = 1 + 0.08 * smooth(0, 0.45, v) + 0.06 * smooth(0.55, 1, t);
      const front = Math.max(0, Math.sin(theta)) ** 1.5;
      const quiff = front * smooth(0.05, 0.55, v) * (1 - smooth(0.8, 1, v));
      return [p[0] * k, 9 + (p[1] - 9) * k + 3.0 * quiff + 1.6 * smooth(0.7, 1, t), p[2] * k + 2.0 * quiff];
    },
    72,
    28,
  );
}

const ARM_UPPER: LatheOpts = {
  y0: -30,
  y1: 3,
  rx: spline([[0, 4.5], [0.3, 4.9], [0.7, 5.5], [0.87, 5.8], [0.95, 4.4], [1, 0]]),
  rz: spline([[0, 4.7], [0.3, 5.2], [0.7, 5.8], [0.87, 6.1], [0.95, 4.6], [1, 0]]),
};
const ARM_FORE: LatheOpts = {
  y0: -27,
  y1: 2,
  rx: spline([[0, 3.6], [0.15, 3.75], [0.6, 4.3], [0.9, 4.5], [1, 4.5]]),
  rz: spline([[0, 3.8], [0.15, 3.95], [0.6, 4.5], [0.9, 4.7], [1, 4.7]]),
};

function shoeGeo(): Geo {
  const sp = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const [a, b, c] = [4.6, 3.7, 13];
  return parametric(
    (u, v) => {
      const eta = -Math.PI / 2 + Math.PI * v;
      const om = -Math.PI + Math.PI * 2 * u;
      const ce = sp(Math.cos(eta), 0.5);
      let x = a * ce * sp(Math.cos(om), 0.65);
      let y = b * sp(Math.sin(eta), 0.5);
      const z = c * ce * sp(Math.sin(om), 0.65);
      const toe = smooth(-0.2, 1, z / c);
      x *= 1 - 0.2 * toe;
      if (y > 0) y *= 1 - 0.45 * smooth(0, 1, z / c);
      return [x, y - 4, z + 4.2];
    },
    32,
    20,
  );
}

function fingerGeo(len: number, r: number, tip: boolean): Geo {
  return lathe({
    y0: -len,
    y1: 0.4,
    rx: tip ? spline([[0, 0], [0.12, r * 0.8], [0.35, r * 0.95], [1, r]]) : () => r,
    rz: tip ? spline([[0, 0], [0.12, r * 0.85], [0.35, r], [1, r * 1.05]]) : () => r * 1.05,
    nu: 12,
    nv: 8,
  });
}

// ---------------------------------------------------------------------------------------------

export class OperatorRig {
  /** CSS-pixel position of the feet inside the canvas (used to pin the canvas to the dock origin). */
  readonly origin: { x: number; y: number };

  private readonly gl: WebGLRenderingContext;
  private readonly prog: WebGLProgram;
  private readonly loc: Record<string, WebGLUniformLocation | null> = {};
  private readonly pProg: WebGLProgram;
  private readonly pLoc: Record<string, WebGLUniformLocation | null> = {};
  private readonly pAttr: { pos: number; col: number; size: number };
  private readonly pBuf: WebGLBuffer;
  private readonly pData = new Float32Array(MAX_PARTICLES * 8);
  private readonly particles: Particle[] = [];
  private readonly emitAcc = { spark: 0, mote: 0, scan: 0 };
  private readonly shadowMat: Mat4;
  private readonly attrs: { pos: number; nrm: number; uv: number };
  private readonly textures: Record<string, WebGLTexture> = {};
  private readonly white: WebGLTexture;
  private readonly nodes = new Map<string, Node>();
  private readonly meshes: Mesh[] = [];
  private readonly flames: Mesh[] = [];
  private readonly root: Node;
  private readonly vp: Mat4;
  private readonly cam: V3 = [0, 128, 420];
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Debug: `?op-pose=salute|wave|thumbs|tie` holds a gesture, `?op-pose=fly` repeats the jet-jump in place. */
  private readonly debugPose = new URLSearchParams(location.search).get('op-pose');
  private readonly forced = this.debugPose && this.debugPose in GESTURE_MS ? (this.debugPose as GestureName) : null;

  private raf = 0;
  private last = performance.now();
  private start = performance.now();
  private scale = 1;

  private yaw = -0.35;
  private yawVel = 0;
  private dragging = false;
  private flightStart = -1e9;
  private flightYaw = 0;
  private gesture: { name: GestureName; start: number } | null = null;
  private facing = false;
  private nextGesture = performance.now() + 3200;
  private gestureIdx = 0;
  private nextBlink = performance.now() + 2000;
  private blinkStart = -1e9;
  private look = { x: 0, y: 0 };
  private lookTarget = { x: 0, y: 0 };
  private headYaw = 0;

  // Smoothing & secondary motion.
  private readonly smoothed: Record<string, V3> = {};
  private smoothedEx: Extras | null = null;
  private readonly bag = { ax: 0, vx: 0, az: 0, vz: 0 };
  private prevYaw = this.yaw;
  private prevFt = 2;
  private saccade = { x: 0, y: 0 };
  private nextSaccade = performance.now() + 900;

  // Deploy-in scan (after the page loader) and landing sweep.
  private materializeAt = Infinity;
  private landedAt = -1e9;

  // Adaptive resolution.
  private baseScale = 1;
  private quality = 1;
  private frameMs = 16;
  private slowFor = 0;
  private fastFor = 0;

  static create(canvas: HTMLCanvasElement): OperatorRig | null {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, stencil: true });
    if (!gl) return null;
    try {
      return new OperatorRig(canvas, gl);
    } catch {
      return null;
    }
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
  ) {
    this.gl = gl;
    this.prog = this.program(VERT, FRAG);
    for (const u of ['uModel', 'uVP', 'uColor', 'uSpec', 'uShine', 'uMode', 'uRefl', 'uMetal', 'uTexMode', 'uTex', 'uTexScale', 'uCam', 'uAlpha', 'uShadow', 'uScanY', 'uScanAmt', 'uScanClip']) {
      this.loc[u] = gl.getUniformLocation(this.prog, u);
    }
    this.pProg = this.program(PVERT, PFRAG);
    for (const u of ['uVP', 'uPx', 'uAdd']) this.pLoc[u] = gl.getUniformLocation(this.pProg, u);
    this.pAttr = {
      pos: gl.getAttribLocation(this.pProg, 'aPos'),
      col: gl.getAttribLocation(this.pProg, 'aCol'),
      size: gl.getAttribLocation(this.pProg, 'aSize'),
    };
    this.pBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.pData.byteLength, gl.DYNAMIC_DRAW);
    // Planar shadow: project onto the floor along an overhead light.
    const [lx, lz, h] = [-0.42, 0.12, 0.3];
    this.shadowMat = identity();
    this.shadowMat.set([1, 0, 0, 0, -lx, 0, -lz, 0, 0, 0, 1, 0, lx * h, h, lz * h, 1]);
    this.attrs = {
      pos: gl.getAttribLocation(this.prog, 'aPos'),
      nrm: gl.getAttribLocation(this.prog, 'aNrm'),
      uv: gl.getAttribLocation(this.prog, 'aUv'),
    };
    this.white = this.texture(Object.assign(document.createElement('canvas'), { width: 1, height: 1 }), '#fff');
    this.textures['face'] = this.texture(faceTex());
    this.textures['chest'] = this.texture(chestTex());
    this.textures['waist'] = this.texture(waistTex());
    this.textures['trouser'] = this.texture(trouserTex());
    this.textures['fabric'] = this.texture(fabricTile());
    this.textures['leather'] = this.texture(leatherTex());

    this.root = this.node('root', undefined, [0, 0, 0]);
    this.build();

    const view = lookAt(this.cam, [0, 102, 0], [0, 1, 0]);
    this.vp = multiply(perspective((30 * Math.PI) / 180, CANVAS_W / CANVAS_H, 50, 1500), view);
    const o = transformPoint(this.vp, [0, 0, 0]);
    this.origin = { x: (o[0] / o[3] * 0.5 + 0.5) * CANVAS_W, y: (1 - (o[1] / o[3] * 0.5 + 0.5)) * CANVAS_H };

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    this.setScale(1);
  }

  // ------------------------------------------------------------------ public API
  play(): void {
    const frame = (now: number) => {
      this.render(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /** Device pixels per CSS pixel of the (unscaled) canvas. */
  setScale(scale: number): void {
    this.baseScale = scale;
    this.applyScale();
  }

  private applyScale(): void {
    this.scale = Math.min(3, Math.max(0.4, this.baseScale * this.quality));
    this.canvas.width = Math.round(CANVAS_W * this.scale);
    this.canvas.height = Math.round(CANVAS_H * this.scale);
  }

  /** Play the holographic deploy-in scan (call once the page is revealed). */
  materialize(): void {
    if (this.materializeAt === Infinity) this.materializeAt = performance.now() + 150;
  }

  fly(): void {
    this.flightStart = performance.now();
    this.flightYaw = this.yaw;
    this.facing = false;
  }

  dragStart(): void {
    this.dragging = true;
    this.yawVel = 0;
    this.facing = false;
    this.gesture = null;
  }

  dragBy(dxCss: number): void {
    this.yaw += dxCss * 0.012;
  }

  dragEnd(velocityCssPerSec: number): void {
    this.dragging = false;
    this.yawVel = Math.max(-12, Math.min(12, velocityCssPerSec * 0.012));
    this.nextGesture = performance.now() + 4500;
  }

  /** Pointer position relative to the viewport centre, −0.5…0.5. */
  lookAt(x: number, y: number): void {
    this.lookTarget = { x, y };
  }

  // ------------------------------------------------------------------ build
  private node(name: string, parent: Node | undefined, t: V3, extra: Partial<Node> = {}): Node {
    const n: Node = { name, t, r: [0, 0, 0], children: [], world: identity(), parent, ...extra };
    parent?.children.push(n);
    this.nodes.set(name, n);
    return n;
  }

  private add(node: Node, geo: Geo, mat: Material, list = this.meshes): void {
    const gl = this.gl;
    const buf = (data: Float32Array | Uint16Array, target: number) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    };
    list.push({
      node,
      mat,
      count: geo.idx.length,
      buf: {
        pos: buf(new Float32Array(geo.pos), gl.ARRAY_BUFFER),
        nrm: buf(new Float32Array(geo.nrm), gl.ARRAY_BUFFER),
        uv: buf(new Float32Array(geo.uv), gl.ARRAY_BUFFER),
        idx: buf(new Uint16Array(geo.idx), gl.ELEMENT_ARRAY_BUFFER),
      },
    });
  }

  private build(): void {
    const at = (x: number, y: number, z: number) => translation(x, y, z);

    const hips = this.node('hips', this.root, [0, 96, 0]);
    this.add(
      hips,
      lathe({
        y0: -14,
        y1: 6,
        rx: spline([[0, 0], [0.15, 12], [0.4, 15.3], [1, 15.7]]),
        rz: spline([[0, 0], [0.15, 8], [0.4, 10.2], [1, 10.4]]),
        rzBack: spline([[0, 0], [0.15, 9], [0.4, 11], [1, 11]]),
        n: 2.4,
      }),
      MAT['trouser'],
    );

    const spine = this.node('spine', hips, [0, 8, 0]);
    this.add(
      spine,
      lathe({
        y0: -20,
        y1: 22,
        rx: spline([[0, 17.6], [0.25, 17.0], [0.5, 15.9], [0.72, 15.5], [1, 15.1]]),
        rz: spline([[0, 11.8], [0.3, 11.2], [0.55, 10.6], [0.8, 10.5], [1, 10.1]]),
        rzBack: spline([[0, 11.4], [0.3, 10.8], [0.55, 10.0], [0.8, 9.9], [1, 9.6]]),
        n: 2.5,
        nu: 56,
        nv: 18,
      }),
      MAT['waist'],
    );

    const chest = this.node('chest', spine, [0, 20, 0]);
    this.add(
      chest,
      lathe({
        y0: -9,
        y1: 25,
        rx: spline([[0, 14.6], [0.12, 15.8], [0.35, 16.6], [0.6, 18.0], [0.78, 19.0], [0.88, 17.4], [0.95, 11], [1, 0]]),
        rz: spline([[0, 9.6], [0.12, 10.7], [0.35, 11.4], [0.6, 11.6], [0.8, 10.2], [0.9, 8.0], [0.96, 5.4], [1, 0]]),
        rzBack: spline([[0, 9.0], [0.12, 10.1], [0.35, 10.4], [0.6, 10.6], [0.8, 9.6], [0.9, 7.6], [0.96, 5.0], [1, 0]]),
        n: 2.6,
        nu: 64,
        nv: 30,
      }),
      MAT['chest'],
    );
    // Shirt collar (open at the front), collar points and tie knot.
    const collarFn = latheFn({ y0: 21.5, y1: 26.2, rx: spline([[0, 6.1], [1, 6.6]]), rz: spline([[0, 6.6], [1, 7.1]]) });
    const gap = 0.42 / (Math.PI * 2);
    this.add(chest, parametric((u, v) => collarFn(0.25 + gap + (1 - 2 * gap) * u, v), 36, 4), MAT['shirt']);
    for (const s of [-1, 1]) {
      this.add(chest, transformGeo(superquadric(1.9, 2.8, 0.32, 0.5, 0.5, 12, 8), multiply(at(s * 2.7, 22.4, 7.6), multiply(rotZ(-s * 0.55), rotX(-0.35)))), MAT['shirt']);
    }
    this.add(chest, transformGeo(ellipsoid(1.45, 1.75, 1.0, 14, 10), at(0, 22.3, 7.5)), MAT['tie']);

    const neck = this.node('neck', chest, [0, 24, 0]);
    this.add(neck, lathe({ y0: -4, y1: 10, rx: () => 5.0, rz: () => 5.3, rzBack: () => 5.6, nu: 28, nv: 6 }), MAT['skin']);

    const head = this.node('head', neck, [0, 8, 0], { s: [1.08, 1.08, 1.08] });
    this.add(head, parametric(headFn, HEAD.nu!, HEAD.nv!), MAT['face']);
    this.add(head, hairGeo(), MAT['hair']);
    for (const s of [-1, 1]) {
      this.add(head, transformGeo(ellipsoid(1.0, 3.0, 1.9, 14, 10), multiply(at(s * 7.45, 10.6, -0.6), rotY(s * 0.3))), MAT['skin']);
      // Eyes: eyeball + iris + pupil rotate together; lids are separate so they can blink.
      const theta = Math.PI / 2 - s * 0.33;
      const p = headFn(theta / (Math.PI * 2), 0.56);
      const l = Math.hypot(p[0], p[2]);
      const c: V3 = [p[0] - (p[0] / l) * 0.62, p[1], p[2] - (p[2] / l) * 0.62];
      const eye = this.node(s > 0 ? 'eyeL' : 'eyeR', head, c);
      this.add(eye, ellipsoid(1.3, 1.3, 1.3, 18, 12), MAT['sclera']);
      this.add(eye, transformGeo(ellipsoid(0.68, 0.68, 0.24, 16, 8), at(0, 0, 1.08)), MAT['iris']);
      this.add(eye, transformGeo(ellipsoid(0.3, 0.3, 0.1, 10, 6), at(0, 0, 1.26)), MAT['pupil']);
      const capFn = (from: number, to: number) => (u: number, v: number): V3 => {
        const phi = from + (to - from) * v;
        const th = u * Math.PI * 2;
        return [1.43 * Math.sin(phi) * Math.cos(th), 1.43 * Math.cos(phi), 1.43 * Math.sin(phi) * Math.sin(th)];
      };
      const lid = this.node(s > 0 ? 'lidL' : 'lidR', head, c);
      this.add(lid, parametric(capFn(0, 1.14), 20, 8), MAT['lid']);
      this.add(head, transformGeo(parametric(capFn(2.1, Math.PI), 20, 6), at(c[0], c[1], c[2])), MAT['lid']);
    }

    for (const side of [1, -1]) {
      const id = side > 0 ? 'L' : 'R';
      const palm = -side; // palm faces the body
      const sh = this.node('sh' + id, chest, [side * 18.5, 19, -0.5]);
      this.add(sh, lathe({ ...ARM_UPPER, nu: 28, nv: 16 }), MAT['sleeve']);
      const el = this.node('el' + id, sh, [0, -29, 0]);
      this.add(el, lathe({ ...ARM_FORE, nu: 28, nv: 14 }), MAT['sleeve']);
      this.add(el, lathe({ y0: -28.6, y1: -25.4, rx: () => 3.45, rz: () => 3.65, nu: 24, nv: 2 }), MAT['shirt']);
      const wr = this.node('wr' + id, el, [0, -26.5, 0]);
      this.add(wr, transformGeo(ellipsoid(1.55, 4.4, 4.1, 18, 12), at(0, -4.6, 0.2)), MAT['skin']);
      FINGERS.forEach((f, i) => {
        const a = this.node(`f${id}${i}a`, wr, [0, -8.4, f.z]);
        this.add(a, fingerGeo(f.a, f.r, false), MAT['skin']);
        const b = this.node(`f${id}${i}b`, a, [0, -f.a, 0]);
        this.add(b, fingerGeo(f.b, f.r * 0.92, true), MAT['skin']);
      });
      const ta = this.node(`t${id}a`, wr, [palm * 0.7, -2.4, 3.1]);
      this.add(ta, fingerGeo(3.4, 1.0, false), MAT['skin']);
      const tb = this.node(`t${id}b`, ta, [0, -3.4, 0]);
      this.add(tb, fingerGeo(2.9, 0.9, true), MAT['skin']);

      if (side > 0) {
        // Laptop briefcase carried in the left hand.
        const bag = this.node('bag', wr, [palm * 1.8, -9.8, 0.3], { hang: true });
        this.add(bag, transformGeo(superquadric(4.6, 13.5, 18, 0.18, 0.18), at(0, -18.5, 0)), MAT['leather']);
        this.add(bag, transformGeo(superquadric(4.85, 5.5, 18.3, 0.2, 0.2), at(0, -10.6, 0)), MAT['flap']);
        for (const x of [-1, 1]) {
          for (const z of [-1, 1]) {
            this.add(bag, transformGeo(superquadric(0.6, 1.5, 1.3, 0.3, 0.3, 12, 8), at(x * 4.95, -15, z * 9)), MAT['metal']);
          }
          this.add(bag, transformGeo(superquadric(1.6, 0.9, 1.5, 0.3, 0.3, 10, 6), at(0, -5, x * 6.2)), MAT['strap']);
        }
        this.add(bag, tube((s) => [0, -5 + 4.3 * Math.sin(Math.PI * s), -6.2 + 12.4 * s], () => 0.95, 10, 18), MAT['strap']);
      }
    }

    for (const side of [1, -1]) {
      const id = side > 0 ? 'L' : 'R';
      const hip = this.node('hip' + id, hips, [side * 9, -4, 0]);
      this.add(
        hip,
        lathe({
          y0: -43,
          y1: 5,
          rx: spline([[0, 5.6], [0.4, 6.4], [0.75, 7.4], [1, 7.9]]),
          rz: spline([[0, 5.8], [0.4, 6.8], [0.75, 7.6], [1, 8]]),
          nu: 32,
          nv: 14,
        }),
        MAT['trouser'],
      );
      const kn = this.node('kn' + id, hip, [0, -42, 0]);
      this.add(
        kn,
        lathe({
          y0: -43,
          y1: 3,
          rx: spline([[0, 5.3], [0.12, 5.0], [0.6, 5.1], [0.85, 5.6], [1, 5.8]]),
          rz: spline([[0, 5.6], [0.12, 5.2], [0.6, 5.4], [0.85, 5.9], [1, 6.1]]),
          nu: 32,
          nv: 14,
        }),
        MAT['trouser'],
      );
      const an = this.node('an' + id, kn, [0, -42, 0]);
      this.add(an, shoeGeo(), MAT['shoe']);
      this.add(an, transformGeo(superquadric(4.9, 0.7, 13.4, 0.2, 0.5, 24, 8), at(0, -7.4, 4.2)), MAT['sole']);
      const flame = this.node('flame' + id, an, [0, -8.2, 3.5]);
      this.add(
        flame,
        mergeGeo([
          lathe({ y0: -30, y1: 0, rx: spline([[0, 0], [0.25, 1.3], [0.6, 2.6], [0.9, 2.9], [1, 2.2]]), rz: spline([[0, 0], [0.25, 1.3], [0.6, 2.6], [0.9, 2.9], [1, 2.2]]), nu: 16, nv: 10 }),
          lathe({ y0: -16, y1: 0, rx: spline([[0, 0], [0.5, 1.2], [1, 1.3]]), rz: spline([[0, 0], [0.5, 1.2], [1, 1.3]]), nu: 12, nv: 6 }),
        ]),
        MAT['flame'],
        this.flames,
      );
    }
  }

  // ------------------------------------------------------------------ animation
  private pose(now: number, dt: number): { pose: Pose; ex: Extras; flame: number; lid: number } {
    const t = (now - this.start) / 1000;
    const b = Math.sin((t * Math.PI * 2) / 4.2);
    const w = this.reduced ? 0 : Math.sin((t * Math.PI * 2) / 7.5);
    const wp = Math.max(0, w);
    const wn = Math.max(0, -w);
    const p: Pose = {
      hips: [0, 0.04 * Math.sin(t * 0.5), 0.022 * w],
      spine: [0.02, 0, -0.018 * w],
      chest: [-0.03 + 0.012 * b, 0, -0.008 * w],
      neck: [0.06, 0, 0.012 * w],
      head: [0, 0, 0],
      shL: [0.04 + 0.01 * b, 0, 0.13 + 0.008 * b],
      elL: [-0.16, 0, 0],
      wrL: [0, 0, 0.06],
      shR: [0.05 + 0.03 * Math.sin(t * 0.9), 0, -0.09 - 0.008 * b],
      elR: [-0.24 - 0.04 * Math.sin(t * 0.9 + 1), 0, 0],
      wrR: [0.05, 0, -0.05],
      hipL: [-0.02 - 0.04 * wn, 0.06, 0.025 - 0.022 * w],
      knL: [0.03 + 0.1 * wn, 0, 0],
      anL: [-0.01 - 0.05 * wn, 0, 0],
      hipR: [-0.02 - 0.04 * wp, -0.06, -0.025 - 0.022 * w],
      knR: [0.03 + 0.1 * wp, 0, 0],
      anR: [-0.01 - 0.05 * wp, 0, 0],
    };
    const ex: Extras = { hipX: 0.9 * w, hipY: 0.25 * b - 0.35 * Math.abs(w), curlL: 1.12, curlR: 0.32, thumbL: 0.85, thumbR: 0.25 };

    // ---- gestures (right arm) ----
    if (this.forced) this.gesture = { name: this.forced, start: now - GESTURE_MS[this.forced] * 0.5 };
    if (this.gesture) {
      const dur = GESTURE_MS[this.gesture.name];
      const gt = (now - this.gesture.start) / dur;
      if (gt >= 1 && !this.forced) {
        this.gesture = null;
        this.facing = false;
        this.nextGesture = now + 3800 + Math.random() * 3500;
      } else {
        const k = this.forced ? 1 : env(gt);
        const gs = (now - this.gesture.start) / 1000;
        this.mix(p, ex, this.gesturePose(this.gesture.name, gs), k);
      }
    }

    // ---- flight: crouch → launch → airborne tuck → land ----
    const ft = (now - this.flightStart) / FLIGHT_MS;
    let flame = 0;
    if (ft >= 0 && ft < 1) {
      const crouch = win(ft, 0, 0.1, 0.13, 0.24) + win(ft, 0.78, 0.88, 0.92, 1);
      const air = win(ft, 0.14, 0.3, 0.72, 0.86);
      flame = win(ft, 0.13, 0.2, 0.74, 0.84);
      this.mix(
        p,
        ex,
        {
          r: {
            spine: [0.22, 0, 0],
            chest: [0.08, 0, 0],
            head: [-0.18, 0, 0],
            shL: [0.45, 0, 0.18],
            shR: [0.55, 0, -0.18],
            elR: [-0.4, 0, 0],
            hipL: [-0.75, 0, 0.05],
            knL: [1.35, 0, 0],
            anL: [-0.6, 0, 0],
            hipR: [-0.75, 0, -0.05],
            knR: [1.35, 0, 0],
            anR: [-0.6, 0, 0],
          },
          hipY: -10,
        },
        crouch,
      );
      this.mix(
        p,
        ex,
        {
          r: {
            spine: [0.16, 0, 0],
            chest: [0.08, 0, 0],
            head: [-0.22, 0, 0],
            shR: [-2.65, 0, -0.12],
            elR: [-0.15, 0, 0],
            wrR: [0, 0, 0],
            shL: [0.3, 0, 0.3],
            elL: [-0.25, 0, 0],
            hipL: [-0.4, 0, 0.06],
            knL: [0.95, 0, 0],
            anL: [0.35, 0, 0],
            hipR: [-1.15, 0, -0.06],
            knR: [1.55, 0, 0],
            anR: [0.4, 0, 0],
          },
          curlR: 1.15,
          thumbR: 0.9,
        },
        air,
      );
    }

    // ---- head & eyes keep eye contact with the camera / pointer ----
    this.look.x += (this.lookTarget.x - this.look.x) * Math.min(1, dt * 4);
    this.look.y += (this.lookTarget.y - this.look.y) * Math.min(1, dt * 4);
    const facingDelta = wrap(this.yaw);
    const want = Math.max(-0.85, Math.min(0.85, -facingDelta)) * (Math.cos(facingDelta) > -0.35 ? 1 : 0.3) + this.look.x * 0.5;
    this.headYaw += (want - this.headYaw) * Math.min(1, dt * 3);
    // Torso turns and leans subtly toward the pointer.
    p['chest'] = [p['chest'][0], p['chest'][1] + this.look.x * 0.14, p['chest'][2]];
    p['spine'] = [p['spine'][0] + this.look.y * 0.03, p['spine'][1], p['spine'][2] - this.look.x * 0.03];
    p['neck'] = [p['neck'][0], p['neck'][1] + this.headYaw * 0.35, p['neck'][2]];
    p['head'] = [p['head'][0] + this.look.y * 0.3, p['head'][1] + this.headYaw * 0.65, p['head'][2]];

    // ---- blink ----
    if (now > this.nextBlink) {
      this.blinkStart = now;
      this.nextBlink = now + 2200 + Math.random() * 3400;
    }
    const bt = (now - this.blinkStart) / 170;
    const lid = bt >= 0 && bt < 1 ? Math.sin(bt * Math.PI) : 0;

    // ---- eye saccades: tiny, instant glances like a real person ----
    if (now > this.nextSaccade) {
      const away = Math.random() < 0.3;
      this.saccade = away ? { x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.14 } : { x: 0, y: 0 };
      this.nextSaccade = now + (away ? 350 + Math.random() * 500 : 900 + Math.random() * 1800);
    }

    return { pose: p, ex, flame, lid };
  }

  private mix(p: Pose, ex: Extras, over: { r: Pose; hipY?: number; curlR?: number; thumbR?: number; curlL?: number }, w: number): void {
    if (w <= 0) return;
    for (const [k, v] of Object.entries(over.r)) {
      const a = p[k];
      p[k] = [lerp(a[0], v[0], w), lerp(a[1], v[1], w), lerp(a[2], v[2], w)];
    }
    if (over.hipY !== undefined) ex.hipY = lerp(ex.hipY, over.hipY, w);
    if (over.curlR !== undefined) ex.curlR = lerp(ex.curlR, over.curlR, w);
    if (over.thumbR !== undefined) ex.thumbR = lerp(ex.thumbR, over.thumbR, w);
    if (over.curlL !== undefined) ex.curlL = lerp(ex.curlL, over.curlL, w);
  }

  private gesturePose(name: GestureName, s: number): { r: Pose; curlR?: number; thumbR?: number } {
    switch (name) {
      case 'salute':
        return {
          r: { shR: [-0.85, -1.57, -1.15], elR: [-2.72, 0, 0], wrR: [0, 0, 0.25], head: [-0.06, 0, 0], chest: [-0.06, 0, 0] },
          curlR: 0.04,
          thumbR: 0.1,
        };
      case 'wave': {
        const osc = Math.sin(s * Math.PI * 2 * 1.9);
        return {
          r: { shR: [-0.2, 0, -2.3], elR: [0, -1.57, -(0.75 + 0.35 * osc)], wrR: [0, 0, 0.15 * osc], head: [0, 0, 0.07], chest: [0, 0, -0.04] },
          curlR: 0.06,
          thumbR: -0.15,
        };
      }
      case 'thumbs':
        return { r: { shR: [-0.35, 0, -0.14], elR: [-1.5, 0.3, 0], wrR: [0, 0, 0], head: [0.04, 0, 0] }, curlR: 1.25, thumbR: -0.35 };
      case 'tie': {
        const tug = Math.sin(s * Math.PI * 2 * 1.3) * 0.06;
        return {
          r: { shR: [-0.3 + tug, 0.45, 0.4], elR: [-1.95, 0, 0], wrR: [0.45, 0, 0.25], neck: [0.12, 0, -0.05], head: [0.1, 0, -0.06] },
          curlR: 0.7,
          thumbR: 0.5,
        };
      }
    }
  }

  private updateYaw(now: number, dt: number): void {
    const ft = (now - this.flightStart) / FLIGHT_MS;
    const auto = this.reduced ? 0 : 0.26;
    if (ft >= 0 && ft < 1) {
      const e = ft < 0.5 ? 2 * ft * ft : 1 - Math.pow(-2 * ft + 2, 2) / 2;
      this.yaw = this.flightYaw + Math.PI * 2 * e;
      return;
    }
    if (this.dragging) return;
    // Turn to face the camera before a gesture, then hold.
    if (!this.gesture && !this.facing && now > this.nextGesture && !this.reduced) this.facing = true;
    if (this.facing || this.forced) {
      const target = Math.round(this.yaw / (Math.PI * 2)) * Math.PI * 2 + 0.12;
      this.yaw += (target - this.yaw) * Math.min(1, dt * 3.2);
      this.yawVel = 0;
      if (!this.gesture && Math.abs(target - this.yaw) < 0.06) {
        const name = GESTURE_ORDER[this.gestureIdx++ % GESTURE_ORDER.length];
        this.gesture = { name, start: now };
      }
      return;
    }
    this.yaw += (auto + this.yawVel) * dt;
    this.yawVel *= Math.exp(-dt * 1.6);
  }

  // ------------------------------------------------------------------ render
  private render(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.adapt(dt);
    if (this.debugPose === 'fly' && now - this.flightStart > 2600 && now > this.materializeAt + 2000) this.fly();
    this.updateYaw(now, dt);
    const raw = this.pose(now, dt);
    const ft = (now - this.flightStart) / FLIGHT_MS;
    const flying = ft >= 0 && ft < 1;

    // Every joint eases toward its target, so gestures, flights and drags never snap.
    const k = 1 - Math.exp(-dt * (flying ? 26 : 15));
    for (const j of JOINTS) {
      const target = raw.pose[j];
      const cur = this.smoothed[j] ?? target;
      this.smoothed[j] = [cur[0] + (target[0] - cur[0]) * k, cur[1] + (target[1] - cur[1]) * k, cur[2] + (target[2] - cur[2]) * k];
      this.nodes.get(j)!.r = this.smoothed[j];
    }
    const sx = this.smoothedEx ?? { ...raw.ex };
    for (const key of Object.keys(raw.ex) as (keyof Extras)[]) sx[key] += (raw.ex[key] - sx[key]) * k;
    this.smoothedEx = sx;
    const { flame, lid } = raw;

    this.root.r = [0, this.yaw, 0];
    this.nodes.get('hips')!.t = [sx.hipX, 96 + sx.hipY, 0];
    for (const [id, palm, curl, thumb] of [
      ['L', 1, sx.curlL, sx.thumbL],
      ['R', -1, sx.curlR, sx.thumbR],
    ] as const) {
      const sgn = -palm; // left palm faces −X, right palm faces +X
      FINGERS.forEach((_, i) => {
        this.nodes.get(`f${id}${i}a`)!.r = [0, 0, sgn * curl * (1.05 + i * 0.06)];
        this.nodes.get(`f${id}${i}b`)!.r = [0, 0, sgn * curl * 1.2];
      });
      this.nodes.get(`t${id}a`)!.r = [-0.55 - 0.2 * thumb, 0, sgn * (0.35 + 0.45 * thumb)];
      this.nodes.get(`t${id}b`)!.r = [0, 0, sgn * thumb * 0.8];
      this.nodes.get('lid' + id)!.r = [0.95 * lid, 0, 0];
      const gaze = Math.max(-0.35, Math.min(0.35, -wrap(this.yaw) - this.headYaw)) + this.look.x * 0.3 + this.saccade.x;
      this.nodes.get('eye' + id)!.r = [this.look.y * 0.25 + this.saccade.y, gaze, 0];
    }

    // Briefcase: damped pendulum driven by spin (centrifugal flare + lag), hip sway and flight.
    const t = (now - this.start) / 1000;
    const air = win(ft, 0.14, 0.3, 0.72, 0.86);
    const yawRate = (this.yaw - this.prevYaw) / dt;
    this.prevYaw = this.yaw;
    const targetX = 0.35 * air - Math.max(-0.4, Math.min(0.4, yawRate * 0.04)) + 0.03 * Math.sin(t * 1.7);
    const targetZ = Math.min(0.45, Math.abs(yawRate) * 0.05) + 0.02 * Math.sin(t * 1.3);
    if (this.prevFt < 0.86 && ft >= 0.86 && ft < 1) {
      this.landedAt = now;
      this.bag.vx += 2.4;
      this.spawnDust();
    }
    this.prevFt = ft;
    for (let i = 0; i < 2; i++) {
      const h = dt / 2;
      this.bag.vx += (38 * (targetX - this.bag.ax) - 3.2 * this.bag.vx) * h;
      this.bag.vz += (38 * (targetZ - this.bag.az) - 3.2 * this.bag.vz) * h;
      this.bag.ax += this.bag.vx * h;
      this.bag.az += this.bag.vz * h;
    }
    this.nodes.get('bag')!.r = [this.bag.ax, 0, this.bag.az];

    const flick = 0.92 + 0.1 * Math.sin(t * 53) + 0.07 * Math.sin(t * 37 + 1.3);
    for (const id of ['L', 'R']) this.nodes.get('flame' + id)!.s = [1, flame * flick, 1];

    this.updateWorld(this.root, identity());

    // Deploy-in scan after the loader, then a lighter sweep on every landing.
    const m = this.reduced ? 2 : (now - this.materializeAt) / 1700;
    let scan = { y: 0, amt: 0, clip: false };
    if (m < 0) scan = { y: -10, amt: 0, clip: true };
    else if (m < 1) scan = { y: -5 + 210 * (1 - Math.pow(1 - m, 2)), amt: 1, clip: true };
    else if (m < 1.3) scan = { y: 205, amt: 1 - (m - 1) / 0.3, clip: false };
    else {
      const ls = (now - this.landedAt) / 750;
      if (ls >= 0 && ls < 1) scan = { y: ls * 205, amt: 0.75 * (1 - ls), clip: false };
    }
    const visible = m < 0 ? 0 : Math.min(1, m * 1.2);

    this.updateParticles(dt, flame, scan, flying);
    this.draw(flame, scan, visible * (1 - air));
  }

  private adapt(dt: number): void {
    this.frameMs = this.frameMs * 0.95 + dt * 1000 * 0.05;
    if (this.frameMs > 24) {
      this.slowFor += dt;
      this.fastFor = 0;
      if (this.slowFor > 1 && this.quality > 0.6) {
        this.quality = Math.max(0.6, this.quality * 0.85);
        this.slowFor = 0;
        this.applyScale();
      }
    } else if (this.frameMs < 14) {
      this.fastFor += dt;
      this.slowFor = 0;
      if (this.fastFor > 4 && this.quality < 1) {
        this.quality = Math.min(1, this.quality * 1.12);
        this.fastFor = 0;
        this.applyScale();
      }
    } else {
      this.slowFor = this.fastFor = 0;
    }
  }

  // ------------------------------------------------------------------ particles
  private spawn(p: Omit<Particle, 'age'>): void {
    if (this.particles.length < MAX_PARTICLES) this.particles.push({ ...p, age: 0 });
  }

  private spawnDust(): void {
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 10;
      const v = 70 + Math.random() * 90;
      this.spawn({
        x: Math.cos(a) * r,
        y: 1.5,
        z: Math.sin(a) * r,
        vx: Math.cos(a) * v,
        vy: 10 + Math.random() * 30,
        vz: Math.sin(a) * v,
        life: 0.9 + Math.random() * 0.6,
        size: 5 + Math.random() * 4,
        kind: 2,
      });
    }
    // Impact sparks skittering along the floor.
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 120 + Math.random() * 160;
      this.spawn({ x: Math.cos(a) * 6, y: 1, z: Math.sin(a) * 6, vx: Math.cos(a) * v, vy: 40 + Math.random() * 90, vz: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, size: 1.2 + Math.random(), kind: 0 });
    }
  }

  private updateParticles(dt: number, flame: number, scan: { y: number; amt: number; clip: boolean }, flying: boolean): void {
    const rnd = Math.random;
    if (flame > 0.15) {
      this.emitAcc.spark += 260 * flame * dt;
      for (; this.emitAcc.spark >= 1; this.emitAcc.spark--) {
        const w = this.nodes.get(rnd() > 0.5 ? 'flameL' : 'flameR')!.world;
        this.spawn({
          x: w[12] + (rnd() - 0.5) * 2,
          y: w[13],
          z: w[14] + (rnd() - 0.5) * 2,
          vx: (rnd() - 0.5) * 80,
          vy: -(150 + rnd() * 170),
          vz: (rnd() - 0.5) * 80,
          life: 0.3 + rnd() * 0.35,
          size: 1.3 + rnd() * 1.4,
          kind: 0,
        });
      }
    }
    if (!flying && !this.reduced) {
      this.emitAcc.mote += 5 * dt;
      for (; this.emitAcc.mote >= 1; this.emitAcc.mote--) {
        const a = rnd() * Math.PI * 2;
        const r = 26 + rnd() * 20;
        this.spawn({ x: Math.cos(a) * r, y: 1, z: Math.sin(a) * r, vx: (rnd() - 0.5) * 6, vy: 10 + rnd() * 16, vz: (rnd() - 0.5) * 6, life: 2.5 + rnd() * 1.8, size: 0.9 + rnd() * 0.9, kind: 1 });
      }
    }
    if (scan.clip && scan.amt > 0.3 && scan.y > 0) {
      this.emitAcc.scan += 110 * dt;
      for (; this.emitAcc.scan >= 1; this.emitAcc.scan--) {
        this.spawn({ x: (rnd() - 0.5) * 46, y: scan.y, z: (rnd() - 0.5) * 26, vx: (rnd() - 0.5) * 24, vy: rnd() * 22, vz: (rnd() - 0.5) * 24, life: 0.4 + rnd() * 0.4, size: 1 + rnd(), kind: 0 });
      }
    }
    const list = this.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      q.age += dt;
      if (q.age >= q.life) {
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      if (q.kind === 0) {
        q.vy -= 380 * dt;
        const d = Math.exp(-dt * 1.2);
        q.vx *= d;
        q.vz *= d;
      } else if (q.kind === 2) {
        const d = Math.exp(-dt * 2.4);
        q.vx *= d;
        q.vy = q.vy * d - 15 * dt;
        q.vz *= d;
        q.size += 7 * dt;
      }
      q.x += q.vx * dt;
      q.y = Math.max(0.5, q.y + q.vy * dt);
      q.z += q.vz * dt;
    }
  }

  private drawParticles(): void {
    const gl = this.gl;
    const list = this.particles;
    if (!list.length) return;
    const d = this.pData;
    let n = 0;
    const put = (q: Particle) => {
      const f = q.age / q.life;
      let r = 1;
      let g = 0.68;
      let b = 0.3;
      let a: number;
      if (q.kind === 0) {
        g = 0.9 - 0.55 * f;
        b = 0.6 - 0.55 * f;
        a = 1 - f;
      } else if (q.kind === 1) {
        a = 0.55 * Math.sin(Math.PI * f);
      } else {
        r = 0.62;
        g = 0.57;
        b = 0.48;
        a = 0.5 * Math.pow(1 - f, 1.3);
      }
      d.set([q.x, q.y, q.z, r, g, b, a, q.size], n * 8);
      n++;
    };
    for (const q of list) if (q.kind !== 2) put(q);
    const additive = n;
    for (const q of list) if (q.kind === 2) put(q);

    gl.useProgram(this.pProg);
    gl.uniformMatrix4fv(this.pLoc['uVP'], false, this.vp);
    gl.uniform1f(this.pLoc['uPx'], (1 / Math.tan((15 * Math.PI) / 180)) * (this.canvas.height / 2));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, n * 8));
    const attr = (loc: number, size: number, offset: number) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 32, offset);
    };
    attr(this.pAttr.pos, 3, 0);
    attr(this.pAttr.col, 4, 12);
    attr(this.pAttr.size, 1, 28);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(this.pLoc['uAdd'], 1);
    if (additive) gl.drawArrays(gl.POINTS, 0, additive);
    gl.uniform1f(this.pLoc['uAdd'], 0);
    if (n > additive) gl.drawArrays(gl.POINTS, additive, n - additive);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disableVertexAttribArray(this.pAttr.col);
    gl.disableVertexAttribArray(this.pAttr.size);
  }

  private updateWorld(n: Node, parent: Mat4): void {
    if (n.hang) {
      const p = transformPoint(parent, n.t);
      n.world = multiply(multiply(translation(p[0], p[1], p[2]), rotY(this.yaw)), jointMatrix([0, 0, 0], n.r, n.s));
    } else {
      n.world = multiply(parent, jointMatrix(n.t, n.r, n.s));
    }
    for (const c of n.children) this.updateWorld(c, n.world);
  }

  private draw(flame: number, scan: { y: number; amt: number; clip: boolean }, shadow: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.loc['uVP'], false, this.vp);
    gl.uniform3fv(this.loc['uCam'], this.cam);
    gl.uniform1i(this.loc['uTex'], 0);
    gl.uniform1f(this.loc['uScanY'], scan.y);
    gl.uniform1f(this.loc['uScanAmt'], scan.amt);
    gl.uniform1f(this.loc['uScanClip'], scan.clip ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);

    // Soft contact shadow on the floor (stencil keeps overlapping limbs from double-darkening).
    if (shadow > 0.01) {
      gl.enable(gl.STENCIL_TEST);
      gl.stencilFunc(gl.EQUAL, 0, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1f(this.loc['uShadow'], 1);
      gl.uniform1f(this.loc['uScanClip'], 0);
      for (const m of this.meshes) this.drawMesh(m, shadow, this.shadowMat);
      gl.uniform1f(this.loc['uShadow'], 0);
      gl.uniform1f(this.loc['uScanClip'], scan.clip ? 1 : 0);
      gl.disable(gl.STENCIL_TEST);
      gl.depthMask(true);
    }

    gl.disable(gl.BLEND);
    for (const m of this.meshes) this.drawMesh(m, 1);
    if (flame > 0.01) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      for (const m of this.flames) this.drawMesh(m, flame);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    this.drawParticles();
  }

  private drawMesh(m: Mesh, alpha: number, pre?: Mat4): void {
    const gl = this.gl;
    const mat = m.mat;
    gl.uniformMatrix4fv(this.loc['uModel'], false, pre ? multiply(pre, m.node.world) : m.node.world);
    gl.uniform1f(this.loc['uRefl'], mat.refl ?? 0);
    gl.uniform1f(this.loc['uMetal'], mat.metal ? 1 : 0);
    gl.uniform3fv(this.loc['uColor'], mat.color);
    gl.uniform1f(this.loc['uSpec'], mat.spec);
    gl.uniform1f(this.loc['uShine'], mat.shine);
    gl.uniform1f(this.loc['uMode'], mat.mode ?? 0);
    gl.uniform1f(this.loc['uTexMode'], mat.tex ? (mat.texMode ?? 1) : 0);
    gl.uniform2fv(this.loc['uTexScale'], mat.texScale ?? [1, 1]);
    gl.uniform1f(this.loc['uAlpha'], alpha);
    gl.bindTexture(gl.TEXTURE_2D, mat.tex ? this.textures[mat.tex] : this.white);
    const bind = (b: WebGLBuffer, attr: number, size: number) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr, size, gl.FLOAT, false, 0, 0);
    };
    bind(m.buf.pos, this.attrs.pos, 3);
    bind(m.buf.nrm, this.attrs.nrm, 3);
    bind(m.buf.uv, this.attrs.uv, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.buf.idx);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  }

  // ------------------------------------------------------------------ GL helpers
  private program(vert: string, frag: string): WebGLProgram {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vert));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  }

  private texture(src: HTMLCanvasElement, fill?: string): WebGLTexture {
    const gl = this.gl;
    if (fill) {
      const ctx = src.getContext('2d')!;
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, src.width, src.height);
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }
}
