import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** Tactical / military-HUD style line icons (24×24). */
const PATHS = {
  crosshair:
    '<circle cx="12" cy="12" r="7"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5"/><circle cx="16" cy="15" r="1" fill="currentColor"/>',
  rank: '<path d="m5 8 7-4 7 4M5 13l7-4 7 4M5 18l7-4 7 4"/>',
  dogtag: '<rect x="6" y="6" width="12" height="16" rx="4"/><circle cx="12" cy="9.5" r="1"/><path d="M12 6V2M9 14h6M9 17h4"/>',
  medal: '<path d="m8 2 4 6 4-6"/><circle cx="12" cy="15" r="6"/><path d="m12 12 .9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3z" fill="currentColor"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  helmet: '<path d="M3 16a9 9 0 0 1 18 0v2H3z"/><path d="M8 18v3h8v-3M12 7v4M3 16h18"/>',
  ammo: '<path d="M5 21V10l1.5-5L8 10v11zM10.5 21V10L12 5l1.5 5v11zM16 21V10l1.5-5 1.5 5v11z"/><path d="M5 17h3M10.5 17h3M16 17h3"/>',
  waypoint: '<path d="m12 2 6 8-6 12-6-12z"/><circle cx="12" cy="9.5" r="2"/>',
  parachute: '<path d="M3 11a9 9 0 0 1 18 0z"/><path d="m3 11 9 8 9-8M8 11l4 8 4-8"/><rect x="10.5" y="19" width="3" height="3"/>',
  radio: '<rect x="4" y="8" width="16" height="13" rx="1"/><path d="m15 8 4-6M8 12h8M8 15h8"/><circle cx="9" cy="18" r="1"/>',
  terminal: '<rect x="2" y="3" width="20" height="18"/><path d="m6 9 4 3-4 3M12 16h6"/>',
  server: '<rect x="2" y="3" width="20" height="7"/><rect x="2" y="14" width="20" height="7"/><path d="M6 6.5h.01M6 17.5h.01M11 6.5h7M11 17.5h7"/>',
  shield: '<path d="m12 2 8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="m8 10 4 3 4-3M8 14l4 3 4-3"/>',
  crate: '<rect x="3" y="6" width="18" height="14"/><path d="M3 10h18M8 6v14M16 6v14M3 6l5-3h8l5 3"/>',
  satellite:
    '<path d="m4 9 5-5 4 4-5 5zM11 16l5-5 4 4-5 5zM8.5 12.5l3 3"/><path d="M15 3a6 6 0 0 1 6 6M15 6.5A2.5 2.5 0 0 1 17.5 9"/>',
  hud: '<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><circle cx="12" cy="12" r="3"/><path d="M12 7v2M12 15v2M7 12h2M15 12h2"/>',
  intel: '<path d="M3 5h6l2 2h10v13H3z"/><path d="M7 12h10M7 16h6"/>',
  squad: '<path d="M5 13a4 4 0 0 1 8 0v1H5zM11 13a4 4 0 0 1 8 0v1h-8z"/><path d="M3 20h18M9 14v6M15 14v6"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7"/><path d="M16 7V4H8v3M2 13h20M11 12h2v2h-2z"/>',
  burst: '<path d="m12 2 2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  chevrons: '<path d="m5 6 6 6-6 6M12 6l6 6-6 6"/>',
  chevronsUp: '<path d="m6 13 6-6 6 6M6 19l6-6 6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect width="13" height="13" x="8" y="8"/><path d="M4 16V4h12"/>',
  transmit:
    '<circle cx="12" cy="10" r="1.6" fill="currentColor"/><path d="M8.5 6.5a5 5 0 0 0 0 7M15.5 6.5a5 5 0 0 1 0 7M5.5 3.5a9 9 0 0 0 0 13M18.5 3.5a9 9 0 0 1 0 13M12 12v10"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  standalone: true,
  template: '',
  host: { class: 'icon', 'aria-hidden': 'true', ngSkipHydration: 'true', '[innerHTML]': 'svg()' },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  private readonly sanitizer = inject(DomSanitizer);
  // Safe: markup comes only from the static PATHS table above.
  protected readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(`<svg viewBox="0 0 24 24">${PATHS[this.name()]}</svg>`),
  );
}
