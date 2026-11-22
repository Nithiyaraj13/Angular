import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { BattlefieldComponent } from '../components/battlefield/battlefield.component';
import { IconComponent } from '../components/icon/icon.component';
import { OperatorComponent } from '../components/operator/operator.component';
import { SkillSphereComponent } from '../components/skill-sphere/skill-sphere.component';
import { CountUpDirective } from '../directives/count-up.directive';
import { RevealDirective } from '../directives/reveal.directive';
import { TiltDirective } from '../directives/tilt.directive';
import {
  ALL_SKILLS,
  CERTIFICATIONS,
  EDUCATION,
  EXPERIENCES,
  FEED,
  PROFILE,
  ROLES,
  SKILL_CATEGORIES,
  STATS,
} from '../data/portfolio.data';

const EMPTY_FORM = { name: '', email: '', subject: '', message: '' };

/** Deterministic ruined-city silhouette for the hero horizon (viewBox 1440x220). */
function skyline(seed: number, min: number, max: number): string {
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const n = (v: number) => v.toFixed(0);
  let x = 0;
  let d = 'M0 220';
  while (x < 1440) {
    const w = 28 + rnd() * 72;
    const top = 220 - (min + rnd() * (max - min));
    d += ` L${n(x)} ${n(top)}`;
    if (rnd() > 0.55) {
      d += ` L${n(x + w * 0.3)} ${n(top + 8 + rnd() * 16)} L${n(x + w * 0.55)} ${n(top - 4)} L${n(x + w * 0.75)} ${n(top + 12)}`;
    }
    if (rnd() > 0.82) {
      const ax = x + w * 0.8;
      d += ` L${n(ax)} ${n(top)} L${n(ax)} ${n(top - 26)} L${n(ax + 2)} ${n(top - 26)} L${n(ax + 2)} ${n(top)}`;
    }
    d += ` L${n(x + w)} ${n(top)}`;
    x += w;
  }
  return `${d} L1440 220 Z`;
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [
    FormsModule,
    BattlefieldComponent,
    IconComponent,
    OperatorComponent,
    SkillSphereComponent,
    CountUpDirective,
    RevealDirective,
    TiltDirective,
  ],
  templateUrl: './portfolio.component.html',
})
export class PortfolioComponent {
  protected readonly profile = PROFILE;
  protected readonly roles = ROLES;
  protected readonly stats = STATS;
  protected readonly categories = SKILL_CATEGORIES;
  protected readonly allSkills = ALL_SKILLS;
  protected readonly experiences = EXPERIENCES;
  protected readonly education = EDUCATION;
  protected readonly certifications = CERTIFICATIONS;
  protected readonly feed = FEED;
  protected readonly skylineFar = skyline(7, 40, 150);
  protected readonly skylineNear = skyline(42, 20, 95);
  protected readonly compassMarks = ['N', '30', '60', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
  protected readonly loadTips = [
    'Tip: Drag the operator to rotate him. Scroll and he jet-jumps to the next sector.',
    'Tip: Click any target in Loadout to lock on to its weapon class.',
    'Tip: Open a mission card to read the full objective list.',
  ];
  protected readonly loadTip = this.loadTips[Math.floor(Math.random() * this.loadTips.length)];
  protected readonly partitions = [0, 1, 2];
  protected readonly environments = ['Dev', 'UAT', 'Stage', 'Prod'];
  protected readonly year = new Date().getFullYear();
  protected readonly sections = [
    { id: 'home', label: 'HQ', title: 'Headquarters' },
    { id: 'about', label: 'Intel', title: 'Operator dossier' },
    { id: 'skills', label: 'Loadout', title: 'Arsenal & loadout' },
    { id: 'experience', label: 'Missions', title: 'Campaign missions' },
    { id: 'credentials', label: 'Medals', title: 'Medals & training' },
    { id: 'contact', label: 'Comms', title: 'Open comms channel' },
  ];
  protected readonly sectionIds = this.sections.map((s) => s.id);

  protected readonly loading = signal(true);
  protected readonly scrolled = signal(false);
  protected readonly showTop = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly active = signal('home');
  protected readonly typed = signal(PROFILE.roles[0]);
  protected readonly activeSection = computed(() => this.sections.find((s) => s.id === this.active()) ?? this.sections[0]);
  protected readonly sectorNo = computed(() => String(this.sections.indexOf(this.activeSection()) + 1).padStart(2, '0'));

  protected readonly activeCategoryId = signal(SKILL_CATEGORIES[0].id);
  protected readonly activeCategory = computed(
    () => this.categories.find((c) => c.id === this.activeCategoryId()) ?? this.categories[0],
  );
  protected readonly activeSkillNames = computed(() => this.activeCategory().items.map((i) => i.name));
  protected readonly pickedSkill = signal<string | null>(null);

  protected readonly expanded = signal<number | null>(0);
  protected readonly flipped = signal<ReadonlySet<number>>(new Set());

  protected form = { ...EMPTY_FORM };
  protected readonly formStatus = signal<'idle' | 'sent' | 'invalid'>('idle');
  protected readonly copied = signal(false);

  private readonly progressBar = viewChild.required<ElementRef<HTMLElement>>('progress');
  private readonly hits = viewChild.required<ElementRef<HTMLElement>>('hits');
  private readonly rank = viewChild.required<ElementRef<HTMLElement>>('rank');
  private readonly compass = viewChild.required<ElementRef<HTMLElement>>('compass');
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const loaderTimer = setTimeout(() => this.loading.set(false), 1500);
      this.destroyRef.onDestroy(() => clearTimeout(loaderTimer));
      this.zone.runOutsideAngular(() => {
        this.bindScroll();
        this.bindPointer();
        this.observeSections();
        this.startTyping();
      });
    });
  }

  protected go(id: string, event?: Event): void {
    event?.preventDefault();
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', id === 'home' ? location.pathname : `#${id}`);
  }

  protected selectCategory(id: string): void {
    this.activeCategoryId.set(id);
    this.pickedSkill.set(null);
  }

  protected pickSkill(name: string): void {
    const category = this.categories.find((c) => c.items.some((i) => i.name === name));
    if (category) this.activeCategoryId.set(category.id);
    this.pickedSkill.set(name);
  }

  protected toggleExperience(i: number): void {
    this.expanded.update((cur) => (cur === i ? null : i));
  }

  protected flip(i: number): void {
    this.flipped.update((set) => {
      const next = new Set(set);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  }

  protected send(f: NgForm): void {
    if (f.invalid) {
      f.control.markAllAsTouched();
      this.formStatus.set('invalid');
      return;
    }
    const { name, email, subject, message } = this.form;
    const body = `${message.trim()}\n\n— ${name.trim()}\n${email.trim()}`;
    const mailSubject = subject.trim() || `Portfolio enquiry from ${name.trim()}`;
    window.location.href = `mailto:${this.profile.email}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(body)}`;
    this.formStatus.set('sent');
    f.resetForm();
    this.form = { ...EMPTY_FORM };
  }

  protected copyEmail(): void {
    navigator.clipboard?.writeText(this.profile.email).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    });
  }

  private bindScroll(): void {
    const bar = this.progressBar().nativeElement;
    const rank = this.rank().nativeElement;
    const compass = this.compass().nativeElement;
    const heading = this.heading().nativeElement;
    const onScroll = () => {
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, y / max) : 0;
      bar.style.transform = `scaleX(${p})`;
      rank.textContent = String(1 + Math.round(p * 54));
      const deg = Math.round(p * 720) % 360;
      heading.textContent = `${String(deg).padStart(3, '0')}°`;
      compass.style.transform = `translateX(${(-deg / 30) * 40}px)`;
      if (y > 30 !== this.scrolled()) this.scrolled.set(y > 30);
      if (y > 700 !== this.showTop()) this.showTop.set(y > 700);
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() => removeEventListener('scroll', onScroll));
  }

  private bindPointer(): void {
    const hits = this.hits().nativeElement;
    const root = document.documentElement;

    let raf = 0;
    let x = 0;
    let y = 0;
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        root.style.setProperty('--px', (x / innerWidth - 0.5).toFixed(3));
        root.style.setProperty('--py', (y / innerHeight - 0.5).toFixed(3));
      });
    };
    // Hit marker on every click, like landing a shot.
    const onDown = (e: PointerEvent) => {
      const m = document.createElement('span');
      m.className = 'hitmarker';
      m.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      hits.appendChild(m);
      setTimeout(() => m.remove(), 320);
    };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    this.destroyRef.onDestroy(() => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      cancelAnimationFrame(raf);
    });
  }

  private observeSections(): void {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) this.active.set(e.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const s of this.sections) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    this.destroyRef.onDestroy(() => io.disconnect());
  }

  private startTyping(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const roles = this.profile.roles;
    let r = 0;
    let c = roles[0].length;
    let deleting = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const word = roles[r];
      c += deleting ? -1 : 1;
      this.typed.set(word.slice(0, c));
      let delay = deleting ? 35 : 80;
      if (!deleting && c === word.length) {
        deleting = true;
        delay = 1900;
      } else if (deleting && c === 0) {
        deleting = false;
        r = (r + 1) % roles.length;
        delay = 350;
      }
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 2600);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}
