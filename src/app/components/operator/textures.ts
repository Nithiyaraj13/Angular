/**
 * Procedurally painted textures. All lathe meshes map u = angle / 2π (front, +Z, at u = 0.25) and v = height,
 * so features are painted around x = 0.25·width. Canvas y = (1 − v)·height (uploaded with FLIP_Y).
 */

export const HAIRLINE = (theta: number) => {
  const s = Math.sin(theta);
  const k = Math.min(1, Math.max(0, (s + 0.9) / 1.75));
  return 0.42 + (0.83 - 0.42) * (k * k * (3 - 2 * k));
};

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Seeded RNG so the textures are identical on every load. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, alpha: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const v = r() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

/** Grey (≈0.5) twill weave tile, multiplied onto fabric colours. */
export function fabricTile(): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = -256; i < 256; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }
  speckle(ctx, 256, 256, 5000, 0.18, 7);
  return c;
}

/** Trouser legs: fabric with a pressed crease down the front and back. */
export function trouserTex(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = '#1b2230';
  ctx.fillRect(0, 0, 512, 256);
  speckle(ctx, 512, 256, 6000, 0.12, 3);
  for (const x of [128, 384]) {
    const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 10, 0, 20, 256);
  }
  return c;
}

export function faceTex(): HTMLCanvasElement {
  const W = 1024;
  const H = 512;
  const [c, ctx] = canvas(W, H);
  const fx = W * 0.25;
  const y = (v: number) => (1 - v) * H;
  const du = (u: number) => u * W;

  // Skin: warm centre of the face, slightly deeper towards the sides and back.
  ctx.fillStyle = '#93603f';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(fx, y(0.5), 20, fx, y(0.5), 360);
  g.addColorStop(0, '#a66e4a');
  g.addColorStop(1, 'rgba(154,99,66,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, W, H, 9000, 0.05, 11);

  // Light stubble / beard shadow around jaw and chin.
  const r = rng(5);
  for (let i = 0; i < 5000; i++) {
    const a = (r() - 0.5) * 2.6;
    const v = 0.03 + r() * 0.28;
    const edge = v > 0.24 ? 1 - (v - 0.24) / 0.07 : 1;
    if (Math.abs(a) < 0.5 && v > 0.17) continue;
    ctx.fillStyle = `rgba(35,24,22,${0.14 * edge * r()})`;
    ctx.fillRect(fx + du(a / (Math.PI * 2)), y(v), 1.6, 1.6);
  }

  // Cheek warmth.
  for (const s of [-1, 1]) {
    const cg = ctx.createRadialGradient(fx + s * 92, y(0.42), 4, fx + s * 92, y(0.42), 60);
    cg.addColorStop(0, 'rgba(196,92,70,0.16)');
    cg.addColorStop(1, 'rgba(196,92,70,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
  }

  // Eye sockets & lid creases (eyeballs and lids are real meshes).
  for (const s of [-1, 1]) {
    const ex = fx + s * 54;
    const sg = ctx.createRadialGradient(ex, y(0.565), 4, ex, y(0.565), 44);
    sg.addColorStop(0, 'rgba(70,38,24,0.38)');
    sg.addColorStop(1, 'rgba(70,38,24,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(ex, y(0.565), 44, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,42,28,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ex, y(0.565), 24, 13, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // Brows: tapered, slightly arched.
  ctx.fillStyle = '#1b120d';
  for (const s of [-1, 1]) {
    const inner = fx + s * 20;
    const outer = fx + s * 86;
    ctx.beginPath();
    ctx.moveTo(inner, y(0.628));
    ctx.quadraticCurveTo(fx + s * 50, y(0.672), outer, y(0.64));
    ctx.quadraticCurveTo(fx + s * 52, y(0.652), inner, y(0.605));
    ctx.closePath();
    ctx.fill();
  }
  const br = rng(9);
  ctx.strokeStyle = 'rgba(20,13,9,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 160; i++) {
    const s = br() > 0.5 ? 1 : -1;
    const t = br();
    const bx = fx + s * (22 + t * 62);
    const by = y(0.625 + Math.sin(t * Math.PI) * 0.025);
    ctx.beginPath();
    ctx.moveTo(bx, by + 3);
    ctx.lineTo(bx + s * 6, by - 3);
    ctx.stroke();
  }

  // Nostrils + nose-side shading.
  ctx.fillStyle = 'rgba(60,28,18,0.7)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(fx + s * 11, y(0.37), 6, 3.2, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mustache (light, like the photo).
  ctx.fillStyle = 'rgba(28,18,13,0.55)';
  ctx.beginPath();
  ctx.moveTo(fx - 44, y(0.255));
  ctx.quadraticCurveTo(fx - 22, y(0.315), fx, y(0.305));
  ctx.quadraticCurveTo(fx + 22, y(0.315), fx + 44, y(0.255));
  ctx.quadraticCurveTo(fx, y(0.285), fx - 44, y(0.255));
  ctx.fill();

  // Sculpting shadows: nose sides, under the nose, under the lower lip, jaw line.
  const shade = (x: number, yy: number, rx: number, ry: number, a: number) => {
    const sg = ctx.createRadialGradient(x, yy, 1, x, yy, Math.max(rx, ry));
    sg.addColorStop(0, `rgba(60,30,18,${a})`);
    sg.addColorStop(1, 'rgba(60,30,18,0)');
    ctx.fillStyle = sg;
    ctx.save();
    ctx.translate(x, yy);
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.translate(-x, -yy);
    ctx.beginPath();
    ctx.arc(x, yy, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  shade(fx + 16, y(0.45), 10, 40, 0.35);
  shade(fx - 16, y(0.45), 10, 40, 0.18);
  shade(fx, y(0.345), 26, 8, 0.35);
  shade(fx, y(0.165), 26, 9, 0.35);
  for (const s of [-1, 1]) shade(fx + s * 120, y(0.2), 40, 70, 0.22);

  // Lips.
  ctx.fillStyle = '#7a4031';
  ctx.beginPath();
  ctx.moveTo(fx - 44, y(0.232));
  ctx.quadraticCurveTo(fx - 18, y(0.262), fx, y(0.25));
  ctx.quadraticCurveTo(fx + 18, y(0.262), fx + 44, y(0.232));
  ctx.quadraticCurveTo(fx, y(0.226), fx - 44, y(0.232));
  ctx.fill();
  const lg = ctx.createLinearGradient(0, y(0.235), 0, y(0.19));
  lg.addColorStop(0, '#7f4434');
  lg.addColorStop(1, '#935643');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(fx - 40, y(0.232));
  ctx.quadraticCurveTo(fx, y(0.226), fx + 40, y(0.232));
  ctx.quadraticCurveTo(fx + 24, y(0.19), fx, y(0.188));
  ctx.quadraticCurveTo(fx - 24, y(0.19), fx - 40, y(0.232));
  ctx.fill();
  ctx.strokeStyle = '#4a2219';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(fx - 46, y(0.238));
  ctx.quadraticCurveTo(fx, y(0.222), fx + 46, y(0.238));
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,210,0.22)';
  ctx.beginPath();
  ctx.ellipse(fx, y(0.205), 14, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair painted under the hair shell (hides any gaps) + sideburns.
  for (let x = 0; x < W; x++) {
    const theta = (x / W) * Math.PI * 2;
    const top = y(HAIRLINE(theta) - 0.015);
    ctx.fillStyle = '#17110d';
    ctx.fillRect(x, 0, 1, top);
  }
  for (const theta of [0.18, Math.PI - 0.18]) {
    ctx.fillStyle = 'rgba(23,17,13,0.85)';
    ctx.fillRect(du(theta / (Math.PI * 2)) - 12, y(0.66), 24, y(0.47) - y(0.66));
  }
  return c;
}

/** Jacket chest: V opening with shirt, tie, lapels and pocket square. */
export function chestTex(): HTMLCanvasElement {
  const W = 1024;
  const H = 512;
  const [c, ctx] = canvas(W, H);
  const fx = W * 0.25;
  const y = (v: number) => (1 - v) * H;
  ctx.fillStyle = '#1f2838';
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, W, H, 16000, 0.12, 21);

  const half = (v: number) => Math.max(0, (v - 0.04) / 0.96) * 74; // V half-width in px
  // Shirt.
  ctx.fillStyle = '#e9eef4';
  ctx.beginPath();
  ctx.moveTo(fx, y(0.04));
  for (let v = 0.04; v <= 1.001; v += 0.02) ctx.lineTo(fx - half(v), y(v));
  for (let v = 1; v >= 0.04; v -= 0.02) ctx.lineTo(fx + half(v), y(v));
  ctx.fill();
  const sh = ctx.createLinearGradient(fx - 70, 0, fx + 70, 0);
  sh.addColorStop(0, 'rgba(90,110,140,0.35)');
  sh.addColorStop(0.5, 'rgba(90,110,140,0)');
  sh.addColorStop(1, 'rgba(90,110,140,0.35)');
  ctx.fillStyle = sh;
  ctx.fill();

  // Tie.
  ctx.fillStyle = '#6d1c24';
  ctx.beginPath();
  ctx.moveTo(fx - 9, y(0.93));
  ctx.lineTo(fx + 9, y(0.93));
  ctx.lineTo(fx + 17, y(0.12));
  ctx.lineTo(fx, y(0.03));
  ctx.lineTo(fx - 17, y(0.12));
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,60,60,0.55)';
  ctx.lineWidth = 4;
  for (let i = -20; i < 30; i++) {
    ctx.beginPath();
    ctx.moveTo(fx - 30, y(0.95) + i * 22);
    ctx.lineTo(fx + 30, y(0.95) + i * 22 + 30);
    ctx.stroke();
  }
  ctx.restore();

  // Lapels with roll shading and notch.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(fx + s * half(0.04), y(0.04));
    for (let v = 0.04; v <= 0.8; v += 0.02) ctx.lineTo(fx + s * half(v), y(v));
    ctx.lineTo(fx + s * (half(0.8) + 34), y(0.83));
    ctx.lineTo(fx + s * (half(0.8) + 22), y(0.76));
    ctx.lineTo(fx + s * (half(0.8) + 40), y(0.72));
    for (let v = 0.7; v >= 0.04; v -= 0.02) ctx.lineTo(fx + s * (half(v) + 8 + (v / 0.7) * 34), y(v));
    ctx.closePath();
    const lg = ctx.createLinearGradient(fx + s * 40, 0, fx + s * 130, 0);
    lg.addColorStop(0, '#2c3850');
    lg.addColorStop(1, '#222c3f');
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fx + s * (half(0.06) + 2), y(0.06));
    for (let v = 0.06; v <= 0.8; v += 0.02) ctx.lineTo(fx + s * (half(v) + 2), y(v));
    ctx.stroke();
  }

  // Breast pocket + pocket square on the wearer's left chest (u < 0.25).
  const px = fx - 104;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(px - 34, y(0.5), 68, 4);
  ctx.fillStyle = '#f2f4f7';
  ctx.beginPath();
  ctx.moveTo(px - 26, y(0.5));
  ctx.lineTo(px - 16, y(0.56));
  ctx.lineTo(px - 6, y(0.515));
  ctx.lineTo(px + 6, y(0.575));
  ctx.lineTo(px + 18, y(0.52));
  ctx.lineTo(px + 26, y(0.5));
  ctx.fill();

  // Back seam.
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.75, 0);
  ctx.lineTo(W * 0.75, H);
  ctx.stroke();
  return c;
}

/** Jacket waist & skirt: buttons, front cut-away, hip pocket flaps, back vent. */
export function waistTex(): HTMLCanvasElement {
  const W = 1024;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  const fx = W * 0.25;
  const y = (v: number) => (1 - v) * H;
  ctx.fillStyle = '#1f2838';
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, W, H, 9000, 0.12, 31);

  // Closure line and cut-away below the lowest button.
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx, y(1));
  ctx.lineTo(fx, y(0.36));
  ctx.stroke();
  ctx.fillStyle = '#141a24';
  ctx.beginPath();
  ctx.moveTo(fx, y(0.36));
  ctx.quadraticCurveTo(fx - 20, y(0.15), fx - 70, y(0));
  ctx.lineTo(fx + 70, y(0));
  ctx.quadraticCurveTo(fx + 20, y(0.15), fx, y(0.36));
  ctx.fill();
  for (const v of [0.4, 0.68]) {
    const bg = ctx.createRadialGradient(fx - 2, y(v) - 2, 1, fx, y(v), 8);
    bg.addColorStop(0, '#3a4252');
    bg.addColorStop(1, '#07090d');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(fx, y(v), 8, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of [-1, 1]) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(fx + s * 150 - 52, y(0.33), 104, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(fx + s * 150 - 52, y(0.33) + 3, 104, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(fx + s * 150 - 52, y(0.33) + 21, 104, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W * 0.75, y(0));
  ctx.lineTo(W * 0.75, y(0.4));
  ctx.stroke();
  return c;
}

/** Leather briefcase grain. */
export function leatherTex(): HTMLCanvasElement {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(13);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.12 * r()})`;
    ctx.beginPath();
    ctx.arc(r() * 256, r() * 256, 1 + r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, 256, 256, 3000, 0.1, 17);
  return c;
}
