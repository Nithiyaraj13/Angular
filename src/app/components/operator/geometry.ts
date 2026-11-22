import { Mat4, V3, cross, norm, sub, transformPoint } from './gl-math';

/** Indexed triangle mesh in plain arrays (uploaded to GL buffers later). */
export interface Geo {
  pos: number[];
  nrm: number[];
  uv: number[];
  idx: number[];
}

type Profile = (t: number) => number;

/** Smooth Catmull-Rom curve through [t, value] control points. */
export function spline(pts: [number, number][]): Profile {
  const n = pts.length;
  return (t) => {
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (t > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const span = p2[0] - p1[0];
    const s = (t - p1[0]) / span;
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * span;
    const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * span;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p1[1] + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * p2[1] + (s3 - s2) * m2;
  };
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const spow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

/** Sample a parametric surface (u, v ∈ [0, 1]) into a mesh with outward normals. */
export function parametric(f: (u: number, v: number) => V3, nu: number, nv: number): Geo {
  const geo: Geo = { pos: [], nrm: [], uv: [], idx: [] };
  const pts: V3[] = [];
  let c: V3 = [0, 0, 0];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p = f(i / nu, j / nv);
      pts.push(p);
      c = [c[0] + p[0], c[1] + p[1], c[2] + p[2]];
    }
  }
  c = [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length];
  const e = 1e-3;
  let facing = 0;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const v = j / nv;
      const p = pts[j * (nu + 1) + i];
      const du = sub(f(u + e, v), f(u - e, v));
      const dv = sub(f(u, Math.min(1, v + e)), f(u, Math.max(0, v - e)));
      let n = cross(du, dv);
      if (Math.hypot(n[0], n[1], n[2]) < 1e-10) n = sub(p, c);
      n = norm(n);
      const out = sub(p, c);
      facing += n[0] * out[0] + n[1] * out[1] + n[2] * out[2];
      geo.pos.push(p[0], p[1], p[2]);
      geo.nrm.push(n[0], n[1], n[2]);
      geo.uv.push(u, v);
    }
  }
  if (facing < 0) for (let k = 0; k < geo.nrm.length; k++) geo.nrm[k] = -geo.nrm[k];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const d = a + nu + 1;
      geo.idx.push(a, d, b, b, d, d + 1);
    }
  }
  return geo;
}

export interface LatheOpts {
  y0: number;
  y1: number;
  rx: Profile;
  rz: Profile;
  /** Depth behind the axis (defaults to rz). */
  rzBack?: Profile;
  /** Superellipse exponent: 2 = ellipse, higher = squarer cross-section. */
  n?: number;
  /** Radial displacement in cm. */
  disp?: (theta: number, t: number) => number;
  nu?: number;
  nv?: number;
}

/** Surface of revolution around Y with elliptical / superelliptical cross-sections. */
export function latheFn(o: LatheOpts): (u: number, v: number) => V3 {
  const ex = 2 / (o.n ?? 2);
  return (u, v) => {
    const theta = u * Math.PI * 2;
    const t = Math.min(1, Math.max(0, v));
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    let x = o.rx(t) * spow(c, ex);
    let z = (s < 0 && o.rzBack ? o.rzBack(t) : o.rz(t)) * spow(s, ex);
    if (o.disp) {
      const d = o.disp(theta, t);
      const l = Math.hypot(x, z) || 1;
      x += (x / l) * d;
      z += (z / l) * d;
    }
    return [x, o.y0 + (o.y1 - o.y0) * t, z];
  };
}

export const lathe = (o: LatheOpts) => parametric(latheFn(o), o.nu ?? 40, o.nv ?? 24);

export function ellipsoid(rx: number, ry: number, rz: number, nu = 24, nv = 16): Geo {
  const r = (t: number) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
  return lathe({ y0: -ry, y1: ry, rx: (t) => rx * r(t), rz: (t) => rz * r(t), nu, nv });
}

/** Rounded-box superquadric; small exponents give flat faces with soft edges. */
export function superquadric(a: number, b: number, c: number, e1 = 0.25, e2 = 0.25, nu = 32, nv = 20): Geo {
  return parametric(
    (u, v) => {
      const eta = -Math.PI / 2 + Math.PI * v;
      const om = -Math.PI + Math.PI * 2 * u;
      const ce = spow(Math.cos(eta), e1);
      return [a * ce * spow(Math.cos(om), e2), b * spow(Math.sin(eta), e1), c * ce * spow(Math.sin(om), e2)];
    },
    nu,
    nv,
  );
}

/** Tube swept along a curve. */
export function tube(curve: (s: number) => V3, radius: (s: number) => number, nu = 12, nv = 16): Geo {
  return parametric(
    (u, v) => {
      const s = Math.min(1, Math.max(0, v));
      const p = curve(s);
      const tan = norm(sub(curve(Math.min(1, s + 0.01)), curve(Math.max(0, s - 0.01))));
      const up: V3 = Math.abs(tan[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
      const side = norm(cross(tan, up));
      const bi = cross(side, tan);
      const phi = u * Math.PI * 2;
      const r = radius(s);
      return [
        p[0] + r * (Math.cos(phi) * side[0] + Math.sin(phi) * bi[0]),
        p[1] + r * (Math.cos(phi) * side[1] + Math.sin(phi) * bi[1]),
        p[2] + r * (Math.cos(phi) * side[2] + Math.sin(phi) * bi[2]),
      ];
    },
    nu,
    nv,
  );
}

/** Bake a rigid transform (rotation + translation, optional uniform scale) into a mesh. */
export function transformGeo(g: Geo, m: Mat4): Geo {
  const out: Geo = { pos: [], nrm: [], uv: g.uv.slice(), idx: g.idx.slice() };
  for (let i = 0; i < g.pos.length; i += 3) {
    const p = transformPoint(m, [g.pos[i], g.pos[i + 1], g.pos[i + 2]]);
    out.pos.push(p[0], p[1], p[2]);
    const n = g.nrm;
    const nx = m[0] * n[i] + m[4] * n[i + 1] + m[8] * n[i + 2];
    const ny = m[1] * n[i] + m[5] * n[i + 1] + m[9] * n[i + 2];
    const nz = m[2] * n[i] + m[6] * n[i + 1] + m[10] * n[i + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    out.nrm.push(nx / l, ny / l, nz / l);
  }
  return out;
}

export function mergeGeo(list: Geo[]): Geo {
  const out: Geo = { pos: [], nrm: [], uv: [], idx: [] };
  for (const g of list) {
    const base = out.pos.length / 3;
    out.pos.push(...g.pos);
    out.nrm.push(...g.nrm);
    out.uv.push(...g.uv);
    for (const i of g.idx) out.idx.push(i + base);
  }
  return out;
}
