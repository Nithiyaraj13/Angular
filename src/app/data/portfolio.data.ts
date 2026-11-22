import { IconName } from '../components/icon/icon.component';

export const PROFILE = {
  firstName: 'Nithiyaraj',
  lastName: 'Vadivel',
  initials: 'NV',
  callsign: 'NV-01',
  coords: '13.08°N · 80.27°E',
  title: 'Technical Consultant',
  company: 'Perficient, Inc.',
  since: 'Jun 2023 — Present',
  location: 'Chennai, Tamil Nadu',
  travel: '100% travel available',
  // TODO: replace with your real contact email — the contact form sends to this address.
  email: 'nithiyarajbtech@gmail.com',
  roles: [
    'Java & Spring Boot Developer',
    'Event-Streaming Engineer',
    'Angular Full-Stack Developer',
    'QA Automation Engineer',
  ],
  tagline:
    'Backend developer with 3+ years at Perficient building Java & Spring Boot microservices, Kafka event-streaming platforms and modern Angular front ends — backed by Playwright test automation.',
  overview: [
    'I am a purposeful back-end developer focused on Java and Spring Boot. I proactively upskilled in Angular, HTML, CSS, Bootstrap and Material Design so I can own features end to end — from the API to the pixel.',
    'I write QA automation with Playwright and work across the complete SDLC: requirement analysis, design, development, testing and deployment. I am known for delivering quality work within tight deadlines, collaborating across teams and building scalable, maintainable solutions.',
  ],
  industries: ['Health care','Finance', 'Retail'],
};

export interface Role {
  title: string;
  className: string;
  icon: IconName;
  description: string;
  tools: string[];
}

export const ROLES: Role[] = [
  {
    title: 'Back-end Developer',
    className: 'Assault',
    icon: 'crosshair',
    description: 'Designing and modernising REST APIs and microservices with Java and Spring Boot, wired into event-driven Kafka architectures.',
    tools: ['Java', 'Spring Boot', 'Microservices', 'Kafka'],
  },
  {
    title: 'Front-end Developer',
    className: 'Recon',
    icon: 'hud',
    description: 'Turning legacy screens into modern, responsive interfaces with Angular, Material Design and Bootstrap.',
    tools: ['Angular', 'Material', 'Bootstrap', 'HTML/CSS'],
  },
  {
    title: 'QA Automation',
    className: 'Engineer',
    icon: 'shield',
    description: 'Building end-to-end Playwright suites and API checks so every release ships with confidence.',
    tools: ['Playwright', 'JUnit', 'Postman', 'SonarQube'],
  },
];

export interface SkillItem {
  name: string;
  note: string;
}

export interface SkillCategory {
  id: string;
  slot: string;
  title: string;
  icon: IconName;
  blurb: string;
  items: SkillItem[];
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: 'backend',
    slot: 'Primary',
    title: 'Backend',
    icon: 'server',
    blurb: 'My core craft — robust, well-validated services built for scale.',
    items: [
      { name: 'Java', note: 'Primary language' },
      { name: 'Spring Boot', note: 'Microservices & REST' },
      { name: 'Spring', note: 'Core framework' },
      { name: 'Microservices', note: 'Architecture' },
      { name: 'REST APIs', note: 'CRUD & search services' },
      { name: 'Maven', note: 'Build & dependency mgmt' },
      { name: 'Flyway', note: 'Versioned DB migrations' },
    ],
  },
  {
    id: 'frontend',
    slot: 'Secondary',
    title: 'Frontend',
    icon: 'hud',
    blurb: 'Modern, responsive interfaces that make complex workflows feel simple.',
    items: [
      { name: 'Angular', note: 'SPA framework' },
      { name: 'Material Design', note: 'Component system' },
      { name: 'Bootstrap', note: 'Responsive layouts' },
      { name: 'HTML5', note: 'Semantic markup' },
      { name: 'CSS3', note: 'Styling & animation' },
    ],
  },
  {
    id: 'streaming',
    slot: 'Tactical',
    title: 'DevOps & Cloud',
    icon: 'satellite',
    blurb: 'Event streaming and containerised delivery across Dev, UAT, Stage and Prod.',
    items: [
      { name: 'Kafka', note: 'Event streaming' },
      { name: 'Confluent Cloud', note: 'Managed Kafka' },
      { name: 'Schema Registry', note: 'Data contracts' },
      { name: 'Docker', note: 'Containerisation' },
      { name: 'Kubernetes', note: 'Orchestration' },
      { name: 'AWS', note: 'Cloud fundamentals' },
    ],
  },
  {
    id: 'database',
    slot: 'Support',
    title: 'Databases',
    icon: 'crate',
    blurb: 'Relational data modelling and schema evolution.',
    items: [
      { name: 'PostgreSQL', note: 'Relational DB' },
      { name: 'MySQL', note: 'Relational DB' },
      { name: 'Oracle SQL', note: 'SQL Developer' },
    ],
  },
  {
    id: 'qa',
    slot: 'Perks',
    title: 'QA & Tools',
    icon: 'shield',
    blurb: 'Automated quality gates from unit tests to cross-browser E2E.',
    items: [
      { name: 'Playwright', note: 'E2E automation' },
      { name: 'JUnit', note: 'Unit testing' },
      { name: 'Postman', note: 'API testing' },
      { name: 'Swagger', note: 'OpenAPI specs' },
      { name: 'BrowserStack', note: 'Cross-browser' },
      { name: 'SonarQube', note: 'Code quality' },
    ],
  },
];

export const ALL_SKILLS = SKILL_CATEGORIES.flatMap((c) => c.items.map((i) => i.name));

export interface Stat {
  value: number;
  decimals: number;
  suffix: string;
  label: string;
  glow: string;
}

export const STATS: Stat[] = [
  { value: 3.4, decimals: 1, suffix: '+', label: 'Years at Perficient', glow: '#f2a900' },
  { value: 3, decimals: 0, suffix: '', label: 'Enterprise clients delivered', glow: '#9bd15c' },
  { value: 4, decimals: 0, suffix: '', label: 'Environments migrated to Confluent Cloud', glow: '#ff6b1a' },
  { value: ALL_SKILLS.length, decimals: 0, suffix: '', label: 'Technologies in my toolkit', glow: '#c9b78a' },
];

export interface Experience {
  client: string;
  domain: string;
  headline: string;
  summary: string;
  responsibilities: string[];
  value: string;
  tags: string[];
  accent: string;
}

export const EXPERIENCES: Experience[] = [
  {
    client: 'Health Care Service',
    domain: 'Enterprise event streaming',
    headline: 'Legacy Kafka → Confluent Cloud migration',
    summary:
      'Led and contributed to migrating enterprise messaging workloads from a legacy Kafka platform to Confluent Cloud — a fully managed, scalable and secure event-streaming architecture across Dev, Test/UAT, Stage and Production. Standardised access control, topic governance, schema management and monitoring for multiple development teams.',
    responsibilities: [
      'Migrated Kafka from legacy infrastructure to Confluent Cloud across Dev, UAT, Stage and PROD environments.',
      'Created service accounts and managed API keys with RBAC for secure access to Kafka clusters and Schema Registry.',
      'Provisioned topics with optimised partitions, replication and retention policies.',
      'Implemented data contracts using Schema Registry to enforce schema governance and compatibility.',
      'Configured consumer groups and permissions, and monitored producer/consumer flows for operational stability.',
    ],
    value: 'Enabled high-throughput, low-latency event streaming that powers real-time data processing and analytics use cases.',
    tags: ['Kafka', 'Confluent Cloud', 'Schema Registry', 'RBAC', 'Data Contracts'],
    accent: '#f2a900',
  },
  {
    client: 'Retailing',
    domain: 'Loyalty program platform',
    headline: 'Backend developer → full-stack owner',
    summary:
      'Joined as a backend developer and transitioned into a full-stack role to support a resource-constrained team. Contributed to analysis, development, testing and deployment of a loyalty platform, and helped design and deliver the Kafka and Playwright integrations.',
    responsibilities: [
      'Participated in design and solutioning for integrating Kafka and Playwright into the existing application.',
      'Integrated Kafka to publish real-time events from the platform.',
      'Transformed a legacy application into a modern UI with Angular and Material Design.',
      'Introduced Playwright end-to-end test automation for faster, more reliable releases.',
      'Authored Flyway versioned and repeatable scripts for database table schemas.',
      'Enhanced APIs with new features without breaking existing performance.',
    ],
    value: 'Took ownership during resource constraints to hit sprint goals — ensuring timely, cost-effective delivery.',
    tags: ['Angular', 'Material', 'Playwright', 'Kafka', 'Flyway', 'Spring Boot'],
    accent: '#9bd15c',
  },
  {
    client: 'Supply chain & logistics',
    domain: 'Application modernisation',
    headline: 'Java / Fuse → Spring Boot services',
    summary:
      'Took part in analysis, development, implementation and testing for migrating the PCA application from Java and Fuse to Maven-based Spring Boot services.',
    responsibilities: [
      'Migrated CRUD and Search services from Java to Spring Boot.',
      'Developed and maintained REST API services from YAML (Swagger/OpenAPI) specifications.',
      'Implemented robust validations and exception handling, and resolved numerous bugs on schedule.',
    ],
    value: 'Moved legacy services to a modern, scalable architecture — improving performance and reducing maintenance overhead.',
    tags: ['Java', 'Spring Boot', 'Maven', 'Swagger', 'REST'],
    accent: '#ff6b1a',
  },
];

export const EDUCATION = {
  degree: 'Bachelor of Technology',
  field: 'Electronics & Communication Engineering',
  specialization: 'Specialisation in Biomedical Engineering',
  school: 'Vellore Institute of Technology',
  year: '2023',
};

export interface Certification {
  title: string;
  issuer: string;
  topics: string[];
}

export const CERTIFICATIONS: Certification[] = [
  {
    title: 'Master Microservices with Spring Boot, Docker & Kubernetes',
    issuer: 'Udemy',
    topics: ['Spring Boot microservices', 'Containers with Docker', 'Orchestration with Kubernetes'],
  },
  {
    title: 'Angular',
    issuer: 'Udemy',
    topics: ['Components & templates', 'RxJS & services', 'Routing & forms'],
  },
  {
    title: 'Apache Kafka for Beginners',
    issuer: 'Udemy',
    topics: ['Topics, partitions & offsets', 'Producers & consumers', 'Consumer groups'],
  },
  {
    title: 'Ultimate AWS Certified AI Practitioner',
    issuer: 'Udemy',
    topics: ['AWS AI/ML services', 'Generative AI fundamentals', 'Responsible AI'],
  },
];

export interface FeedItem {
  target: string;
  op: string;
}

/** "Kill feed" of real wins from the resume, shown in the hero HUD. */
export const FEED: FeedItem[] = [
  { target: 'Legacy Kafka → Confluent Cloud', op: 'BCBSMA' },
  { target: 'Schema Registry data contracts', op: 'BCBSMA' },
  { target: 'Legacy UI → Angular + Material', op: 'KOBIE' },
  { target: 'Playwright E2E suite shipped', op: 'KOBIE' },
  { target: 'Java / Fuse → Spring Boot', op: 'FERGUSON' },
];
