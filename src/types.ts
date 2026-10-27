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
  id: string;
  name: string;
  origin: string;
  requireAdmission: boolean;
  questionsVersion: number;
  questions: Question[];
  hasIngestKey: boolean;
  collectorOrigin?: string;
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
  serverTime: string;
};
