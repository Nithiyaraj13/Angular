import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective {
  readonly appCountUp = input.required<number>();
  readonly decimals = input(0);

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const target = this.appCountUp();
      const decimals = this.decimals();
      el.textContent = (0).toFixed(decimals);

      let raf = 0;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          const start = performance.now();
          const step = (now: number) => {
            const p = Math.min(1, (now - start) / 1600);
            el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(decimals);
            if (p < 1) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
        },
        { threshold: 0.6 },
      );
      io.observe(el);
      destroyRef.onDestroy(() => {
        io.disconnect();
        cancelAnimationFrame(raf);
      });
    });
  }
}
