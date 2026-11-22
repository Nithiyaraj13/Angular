import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject, input } from '@angular/core';

@Directive({
  selector: '[appTilt]',
  standalone: true,
  host: { class: 'tilt' },
})
export class TiltDirective {
  readonly tiltMax = input(8);

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!canHover || reduced) return;

      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const max = this.tiltMax();
        el.classList.add('tilting');
        el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) scale3d(1.02,1.02,1.02)`;
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
      };
      const leave = () => {
        el.classList.remove('tilting');
        el.style.transform = '';
      };

      zone.runOutsideAngular(() => {
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
      });
      destroyRef.onDestroy(() => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      });
    });
  }
}
