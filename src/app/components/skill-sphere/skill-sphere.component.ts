import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-skill-sphere',
  standalone: true,
  template: `
    <div class="stage" #stage>
      @for (skill of skills(); track skill) {
        <button type="button" class="tag" [class.hl]="highlighted().has(skill)" (click)="picked.emit(skill)">
          {{ skill }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .stage {
        position: relative; width: 100%; max-width: 500px; aspect-ratio: 1; margin: 0 auto;
        perspective: 900px; transform-style: preserve-3d; touch-action: pan-y; user-select: none;
      }
      .stage::before {
        content: ''; position: absolute; inset: 12%; border-radius: 50%;
        background:
          radial-gradient(circle, transparent 0 32%, rgba(155,209,92,.18) 32% 32.6%, transparent 32.6% 64%, rgba(155,209,92,.18) 64% 64.6%, transparent 64.6%),
          linear-gradient(rgba(155,209,92,.14), rgba(155,209,92,.14)) center/1px 100% no-repeat,
          linear-gradient(rgba(155,209,92,.14), rgba(155,209,92,.14)) center/100% 1px no-repeat,
          radial-gradient(circle, rgba(30,50,20,.55), rgba(5,10,5,.2) 70%);
        border: 1px solid rgba(155,209,92,.35);
      }
      .stage::after {
        content: ''; position: absolute; inset: 12%; border-radius: 50%; pointer-events: none;
        background: conic-gradient(from 0deg, rgba(155,209,92,.28), transparent 18%);
        animation: sweep 4s linear infinite;
      }
      @keyframes sweep { to { transform: rotate(360deg); } }
      .tag {
        position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
        padding: 4px 10px; font-family: 'Share Tech Mono', monospace; font-size: .8rem; letter-spacing: .06em;
        text-transform: uppercase; white-space: nowrap; color: #e7e3d4;
        background: rgba(8,10,6,.85); border: 1px solid rgba(201,183,138,.3);
        will-change: transform, opacity; cursor: pointer;
        transition: background .25s, color .25s, border-color .25s, box-shadow .25s;
      }
      .tag::before { content: '[ '; color: #f2a900; }
      .tag::after { content: ' ]'; color: #f2a900; }
      .tag:hover, .tag:focus-visible { background: #e5432f; border-color: #e5432f; color: #fff; outline: none; }
      .tag.hl { background: #f2a900; color: #0b0b08; border-color: #f2a900; box-shadow: 0 0 20px rgba(242,169,0,.6); }
      .tag.hl::before, .tag.hl::after { color: #0b0b08; }
    `,
  ],
})
export class SkillSphereComponent {
  readonly skills = input.required<string[]>();
  readonly highlight = input<string[]>([]);
  readonly picked = output<string>();

  protected readonly highlighted = computed(() => new Set(this.highlight()));
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.start()));
  }

  private start(): void {
    const stage = this.stage().nativeElement;
    const tags = Array.from(stage.querySelectorAll<HTMLElement>('.tag'));
    const n = tags.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts = tags.map((_, i) => {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      return { x: Math.cos(i * golden) * r, y, z: Math.sin(i * golden) * r };
    });

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const idle = { x: 0.0015, y: 0.0035 };
    const vel = { ...idle };
    const target = { ...idle };
    let radius = stage.clientWidth * 0.36;

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      target.y = dx * 0.03;
      target.x = -dy * 0.03;
    };
    const onLeave = () => Object.assign(target, idle);

    const render = () => {
      vel.x += (target.x - vel.x) * 0.06;
      vel.y += (target.y - vel.y) * 0.06;
      const cx = Math.cos(vel.x);
      const sx = Math.sin(vel.x);
      const cy = Math.cos(vel.y);
      const sy = Math.sin(vel.y);
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const y1 = p.y * cx - p.z * sx;
        const z1 = p.y * sx + p.z * cx;
        const x2 = p.x * cy + z1 * sy;
        const z2 = -p.x * sy + z1 * cy;
        p.x = x2;
        p.y = y1;
        p.z = z2;
        const depth = (z2 + 1) / 2;
        const el = tags[i];
        el.style.transform = `translate(-50%,-50%) translate3d(${(x2 * radius).toFixed(1)}px,${(y1 * radius).toFixed(1)}px,${(z2 * radius).toFixed(1)}px)`;
        el.style.opacity = (0.22 + 0.78 * depth).toFixed(2);
        el.style.zIndex = String(Math.round(depth * 100));
      }
    };

    let raf = 0;
    let running = false;
    const loop = () => {
      render();
      raf = requestAnimationFrame(loop);
    };
    const play = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    render();
    const ro = new ResizeObserver(() => {
      radius = stage.clientWidth * 0.36;
      if (!running) render();
    });
    ro.observe(stage);
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause()));
    io.observe(stage);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);

    this.destroyRef.onDestroy(() => {
      pause();
      ro.disconnect();
      io.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    });
  }
}
