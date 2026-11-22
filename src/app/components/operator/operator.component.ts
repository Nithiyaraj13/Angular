import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { CANVAS_H, CANVAS_W, FLIGHT_MS, OperatorRig } from './operator-rig';

/** Figure bounds at scale 1 (px): feet to raised hand, and the sweep of the briefcase while spinning. */
const FIG_H = 400;
const FIG_W = 220;

interface Spot {
  x: number;
  y: number;
  s: number;
  mini: boolean;
}

/**
 * Full-body WebGL operator in a formal suit carrying a laptop briefcase in his left hand.
 * Lives in a fixed layer: stands on the hero's `[data-op-spot]`, then jet-jumps to a side gutter (or a corner on
 * small screens) whenever the active section changes. Turns slowly, gestures (salute, wave, thumbs-up, tie),
 * blinks, keeps eye contact, and can be dragged to rotate.
 */
@Component({
  selector: 'app-operator',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'op', 'aria-hidden': 'true' },
  template: `
    <div class="op-scale">
      <div class="op-shadow"></div>
      <div class="op-pad"><i></i><b></b></div>
      <div class="op-arc">
        <canvas class="op-canvas" #canvas [width]="w" [height]="h" [style.width.px]="w" [style.height.px]="h"></canvas>
      </div>
      <div class="op-hit" #hit></div>
      <span class="op-label">Drag to rotate</span>
    </div>
  `,
})
export class OperatorComponent {
  /** Currently active section id. */
  readonly section = input('home');
  /** Section ids in page order; used to alternate the side the operator lands on. */
  readonly order = input<string[]>([]);
  /** True once the page loader has gone; triggers the holographic deploy-in. */
  readonly revealed = input(false);

  protected readonly w = CANVAS_W;
  protected readonly h = CANVAS_H;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly hit = viewChild.required<ElementRef<HTMLElement>>('hit');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private rig: OperatorRig | null = null;
  private ready = false;
  private current = 'home';
  private tracking = true;
  private reduced = false;
  private flightTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const id = this.section();
      untracked(() => {
        if (this.ready && id !== this.current) this.zone.runOutsideAngular(() => this.flyTo(id));
      });
    });
    effect(() => {
      if (this.revealed()) untracked(() => this.rig?.materialize());
    });
    afterNextRender(() => this.zone.runOutsideAngular(() => this.init()));
  }

  private init(): void {
    const el = this.host.nativeElement;
    const canvas = this.canvas().nativeElement;
    this.rig = OperatorRig.create(canvas);
    if (!this.rig) {
      el.classList.add('no-gl');
      return;
    }
    canvas.style.left = `${-this.rig.origin.x}px`;
    canvas.style.top = `${-this.rig.origin.y}px`;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.current = this.section();
    this.tracking = this.current === 'home';
    this.apply(this.spotFor(this.current));
    this.ready = true;
    this.rig.play();
    if (this.revealed()) this.rig.materialize();
    requestAnimationFrame(() => el.classList.add('ready'));

    this.bindDrag();

    let raf = 0;
    const reposition = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (this.tracking) this.apply(this.spotFor('home'));
      });
    };
    const onResize = () => {
      if (!el.classList.contains('moving')) this.apply(this.spotFor(this.current));
    };
    const onPointer = (e: PointerEvent) => this.rig?.lookAt(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    addEventListener('scroll', reposition, { passive: true });
    addEventListener('resize', onResize);
    addEventListener('pointermove', onPointer, { passive: true });
    this.destroyRef.onDestroy(() => {
      removeEventListener('scroll', reposition);
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onPointer);
      cancelAnimationFrame(raf);
      clearTimeout(this.flightTimer);
      this.rig?.destroy();
    });
  }

  private flyTo(id: string): void {
    const el = this.host.nativeElement;
    this.current = id;
    this.tracking = false;
    clearTimeout(this.flightTimer);
    if (this.reduced) {
      this.apply(this.spotFor(id));
      this.tracking = id === 'home';
      return;
    }
    el.classList.remove('landed');
    el.classList.add('moving', 'flying');
    void el.offsetWidth; // restart the arc animation if a flight is interrupted
    this.rig?.fly();
    this.apply(this.spotFor(id));
    this.flightTimer = setTimeout(() => {
      el.classList.remove('moving', 'flying');
      el.classList.add('landed');
      this.tracking = this.current === 'home';
      if (this.tracking) this.apply(this.spotFor('home'));
    }, FLIGHT_MS);
  }

  private spotFor(id: string): Spot {
    const vw = innerWidth;
    const vh = innerHeight;
    if (id === 'home') {
      const spot = document.querySelector<HTMLElement>('[data-op-spot]');
      if (spot) {
        const r = spot.getBoundingClientRect();
        const s = clamp(Math.min((r.height * 0.95) / FIG_H, (r.width * 0.95) / FIG_W), 0.42, 1.4);
        return { x: r.left + r.width / 2, y: r.bottom - 6, s, mini: false };
      }
    }
    if (vw >= 1280) {
      const gutter = (vw - Math.min(1100, vw - 380)) / 2;
      const right = this.order().indexOf(id) % 2 === 1;
      const s = Math.min((gutter * 0.85) / FIG_W, ((vh - 200) * 0.85) / FIG_H, 0.9);
      // Feet sit above the corner HUD readouts and the back-to-top button.
      return { x: right ? vw - gutter / 2 : gutter / 2, y: vh - 110, s, mini: false };
    }
    const s = vw < 600 ? 0.3 : 0.4;
    return { x: 18 + (FIG_W * s) / 2, y: vh - 10, s, mini: true };
  }

  private apply(spot: Spot): void {
    const el = this.host.nativeElement;
    el.style.setProperty('--x', `${spot.x.toFixed(1)}px`);
    el.style.setProperty('--y', `${spot.y.toFixed(1)}px`);
    el.style.setProperty('--s', spot.s.toFixed(3));
    el.classList.toggle('mini', spot.mini);
    el.classList.toggle('away', this.current !== 'home');
    // Slight supersampling keeps edges and the face crisp.
    this.rig?.setScale(spot.s * Math.min(devicePixelRatio || 1, 2) * 1.25);
  }

  private bindDrag(): void {
    const hit = this.hit().nativeElement;
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastT = performance.now();
      vel = 0;
      hit.setPointerCapture(e.pointerId);
      this.host.nativeElement.classList.add('grabbing');
      this.rig?.dragStart();
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      vel = dx / Math.max(0.008, (now - lastT) / 1000);
      lastX = e.clientX;
      lastT = now;
      this.rig?.dragBy(dx);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      this.host.nativeElement.classList.remove('grabbing');
      this.rig?.dragEnd(performance.now() - lastT < 80 ? vel : 0);
    };
    hit.addEventListener('pointerdown', down);
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerup', up);
    hit.addEventListener('pointercancel', up);
    this.destroyRef.onDestroy(() => {
      hit.removeEventListener('pointerdown', down);
      hit.removeEventListener('pointermove', move);
      hit.removeEventListener('pointerup', up);
      hit.removeEventListener('pointercancel', up);
    });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
