import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: { class: 'reveal', '[style.--reveal-delay]': "revealDelay() + 'ms'" },
})
export class RevealDirective {
  readonly revealDelay = input(0);

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            el.classList.add('in-view');
            io.disconnect();
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
      );
      io.observe(el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}
