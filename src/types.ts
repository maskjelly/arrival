export type Question = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect';
  required: boolean;
  options: string[];
};
export type Evidence = {
  name: string;
  value: string;
  source:
    | 'request header'
    | 'server observed'
    | 'browser reported'
    | 'integration reported'
    | 'agent reported';
  note?: string;
};
export type Site = {
  workspace?: string;
  entryMode?: 'ask' | 'observe';
  entryMessage?: string;
  id: string;
  name: string;
  origin: string;
  requireAdmission: boolean;
  questionsVersion: number;
  questions: Question[];
  hasIngestKey: boolean;
  collectorOrigin?: string;
};
export type NetworkLookup = {
  enrichment: {
    status: 'enriched' | 'non-public address' | 'no match' | 'not installed' | 'lookup failed';
    source?: string;
    lookedUpAt?: string;
    cityBuiltAt?: string;
    asnBuiltAt?: string;
  };
  location?: {
    countryCode?: string;
    country?: string;
    continent?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    approximate: boolean;
  };
  asn?: { number: number; organization: string; prefixLength?: number };
  hosting?: { provider: string; kind: 'cloud / hosting / CDN'; confidence: 'inferred' };
};
export type NetworkContext = NetworkLookup & {
  ip: string;
  peerIp?: string;
  version: 4 | 6 | null;
  scope: string;
  ipSource: 'direct connection' | 'trusted proxy' | 'integration reported' | 'stored address';
  observedAt: string;
  request: {
    method?: string;
    httpVersion?: string;
    scheme?: string;
    headers?: Record<string, string>;
  };
  history?: { ip: string; observedAt: string; source: string }[];
};
export type NetworkStatus = {
  updatesManaged?: boolean;
  enabled: boolean;
  provider: { name: string; url: string; license: string; licenseUrl: string };
  city: { available: boolean; builtAt?: string; stale?: boolean; type?: string };
  asn: { available: boolean; builtAt?: string; stale?: boolean; type?: string };
  job: {
    running: boolean;
    stage: string;
    downloadedBytes?: number;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  };
  errors: string[];
};
export type Visit = {
  id: string;
  siteId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  status: 'awaiting' | 'admitted' | 'observed' | 'revoked' | 'expired';
  source: 'gateway' | 'browser' | 'server' | 'agent';
  isDemo: boolean;
  userAgent: string;
  ip: string;
  network?: NetworkContext;
  referrer: string;
  entryPath: string;
  agentName: string;
  classification: 'self-identifying bot' | 'automation signals' | 'unknown';
  evidence: Evidence[];
  environment: Record<string, unknown>;
  answers: Record<string, string | string[]>;
  questions: Question[];
  questionsVersion: number;
  permissions: string[];
  eventCount: number;
  pageCount: number;
  objective: string;
  eventTypes: string[];
};
export type VisitEvent = {
  id: string;
  sessionId: string;
  createdAt: string;
  type: string;
  path: string;
  method: string;
  status: number | null;
  source: string;
  data: Record<string, unknown>;
};
export type Overview = {
  entry?: { prompted: number; answered: number; continued: number };
  site: Site;
  sessions: Visit[];
  total: number;
  stats: {
    visits: number;
    admitted: number;
    answered: number;
    events: number;
    automated: number;
    demo: number;
  };
  chart: { time: string; visits: number; events: number }[];
  pages: { path: string; count: number }[];
  sources: { name: string; count: number }[];
  network: {
    countryCount: number;
    located: number;
    asnResolved: number;
    publicAddresses: number;
    total: number;
    countries: { code: string; name: string; count: number }[];
    regions?: { countryCode: string; name: string; count: number }[];
    providers: { name: string; count: number }[];
    status: NetworkStatus;
  };
  serverTime: string;
};
