import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, viewChild } from '@angular/core';

interface Smoke {
  x: number;
  y: number;
  r: number;
  vx: number;
  a: number;
}
interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}
interface Flash {
  x: number;
  y: number;
  r: number;
  t0: number;
}
interface Tracer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
}

/** Fixed full-screen battlefield ambience: drifting smoke, rising embers, distant artillery flashes and tracers. */
@Component({
  selector: 'app-battlefield',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: [':host{position:fixed;inset:0;z-index:-1;display:block;pointer-events:none}canvas{width:100%;height:100%;display:block}'],
})
export class BattlefieldComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.start()));
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = innerWidth < 700;

    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 256;
    const sctx = sprite.getContext('2d')!;
    const sg = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    sg.addColorStop(0, 'rgba(150,145,125,0.55)');
    sg.addColorStop(0.5, 'rgba(110,108,95,0.22)');
    sg.addColorStop(1, 'rgba(90,90,80,0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 256, 256);

    let w = 0;
    let h = 0;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const smokes: Smoke[] = Array.from({ length: small ? 7 : 13 }, () => ({
      x: rand(-0.2, 1.2),
      y: rand(0.35, 1.1),
      r: rand(220, 520),
      vx: rand(-0.012, -0.004),
      a: rand(0.05, 0.13),
    }));
    const newEmber = (anywhere: boolean): Ember => ({
      x: Math.random(),
      y: anywhere ? Math.random() : rand(1, 1.1),
      vx: rand(-0.012, 0.02),
      vy: rand(-0.06, -0.025),
      size: rand(0.6, 2.2),
      phase: rand(0, Math.PI * 2),
    });
    const embers: Ember[] = Array.from({ length: small ? 34 : 70 }, () => newEmber(true));
    const flashes: Flash[] = [];
    const tracers: Tracer[] = [];
    let nextFlash = performance.now() + 1200;
    let nextTracer = performance.now() + 800;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      const drift = (scrollY * 0.04) % h;

      // Smoke
      ctx.globalCompositeOperation = 'source-over';
      for (const s of smokes) {
        s.x += s.vx * dt;
        if (s.x < -0.4) s.x = 1.3;
        ctx.globalAlpha = s.a;
        const px = s.x * w;
        const py = s.y * h - drift * 0.5;
        ctx.drawImage(sprite, px - s.r, py - s.r, s.r * 2, s.r * 2);
      }

      ctx.globalCompositeOperation = 'lighter';

      // Artillery flashes on the horizon
      if (now > nextFlash) {
        flashes.push({ x: rand(0.05, 0.95) * w, y: h * rand(0.8, 1.02), r: rand(260, 620), t0: now });
        nextFlash = now + rand(2200, 5200);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        const t = (now - f.t0) / 900;
        if (t >= 1) {
          flashes.splice(i, 1);
          continue;
        }
        const a = (t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92) * 0.28;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(255,170,60,${a})`);
        g.addColorStop(0.4, `rgba(255,100,20,${a * 0.45})`);
        g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      }

      // Tracer rounds
      if (now > nextTracer) {
        const ltr = Math.random() > 0.5;
        tracers.push({
          x: ltr ? -80 : w + 80,
          y: h * rand(0.15, 0.75),
          vx: (ltr ? 1 : -1) * rand(1400, 2200),
          vy: rand(-120, 120),
          t0: now,
        });
        nextTracer = now + rand(900, 2600);
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        if (t.x < -200 || t.x > w + 200) {
          tracers.splice(i, 1);
          continue;
        }
        const len = 0.07;
        const g = ctx.createLinearGradient(t.x, t.y, t.x - t.vx * len, t.y - t.vy * len);
        g.addColorStop(0, 'rgba(255,220,140,0.9)');
        g.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x - t.vx * len, t.y - t.vy * len);
        ctx.stroke();
      }

      // Embers
      for (const e of embers) {
        e.x += (e.vx + Math.sin(now / 900 + e.phase) * 0.008) * dt;
        e.y += e.vy * dt;
        if (e.y < -0.05) Object.assign(e, newEmber(false));
        const flicker = 0.55 + 0.45 * Math.sin(now / 140 + e.phase * 3);
        ctx.globalAlpha = 0.85 * flicker;
        ctx.fillStyle = e.size > 1.6 ? '#ffb347' : '#ff7a22';
        ctx.beginPath();
        ctx.arc(e.x * w, e.y * h, e.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    let raf = 0;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    if (reduced) draw(performance.now());
    else raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(performance.now());
    });
    ro.observe(canvas);
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    });
  }
}
