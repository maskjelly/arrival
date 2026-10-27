export const stack = [
  { name: 'React 19 + TypeScript', role: 'Dashboard, landing page, and typed application code.' },
  { name: 'Vite 8', role: 'Local development and production frontend builds.' },
  { name: 'Node.js + Express 5', role: 'Check-in, permissions, collection, and owner APIs.' },
  { name: 'SQLite', role: 'Persistent visits, versioned questions, answers, and event history.' },
  { name: 'Zod 4', role: 'Server validation for answers, configuration, and telemetry.' },
  {
    name: 'Native CSS + Outfit',
    role: 'Woven surfaces, stitched controls, and responsive layouts.',
  },
  { name: 'Playwright + node:test', role: 'Browser journeys and API/integration checks.' },
];

export const builtFeatures = [
  {
    title: 'Questions that belong to your site',
    detail:
      'Required and optional text, long answers, single choice, and multiple choice. Every visit retains its question version.',
  },
  {
    title: 'A visit record with context',
    detail:
      'Declared objectives, discovery sources, browser hints, request metadata, and an event timeline.',
  },
  {
    title: 'A protected demonstration site',
    detail:
      'Browser and HTTP check-in, one-hour grants, read/search/download permissions, expiry, and revocation.',
  },
  {
    title: 'Browser and server collection',
    detail:
      'An embeddable tracker with a voluntary questionnaire, plus authenticated ingestion and an Express adapter.',
  },
  {
    title: 'An owner workspace',
    detail:
      'Visit filters, live polling, question editing, integration setup, local owner sessions, and JSON/CSV exports.',
  },
  {
    title: 'Persistent local storage',
    detail:
      'SQLite records survive restarts. Tests cover real HTTP and browser journeys, including a separate host website.',
  },
];

export const nextFeatures = [
  {
    title: 'Verified operator identities',
    detail:
      'Add signed-agent verification such as Web Bot Auth. Current names and objectives remain unverified.',
  },
  {
    title: 'Stronger, measured detection',
    detail:
      'Benchmark browser and computer-use agents, measure false positives, and integrate authoritative WAF signals.',
  },
  {
    title: 'A deployable admission adapter',
    detail:
      'Apply server-side admission to external host websites. The current embed only collects data and voluntary answers.',
  },
  {
    title: 'Multiple sites and teams',
    detail:
      'Tenant isolation, account authentication, team roles, and independent site configurations.',
  },
  {
    title: 'Reliable collection at scale',
    detail:
      'Durable queues, retries, pagination beyond current limits, retention rules, and deletion controls.',
  },
  {
    title: 'Production hosting and operations',
    detail:
      'Managed HTTPS deployment, monitoring, backups, and operating procedures. Billing can follow if needed.',
  },
];
