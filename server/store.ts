import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Evidence, Question, Site, Visit, VisitEvent } from '../src/types.ts';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const credential = () => randomBytes(32).toString('base64url');
const now = () => new Date().toISOString();
const json = <T>(value: unknown): T => JSON.parse(String(value));
type Row = Record<string, unknown>;
export const defaultQuestions: Question[] = [
  {
    id: 'agent_name',
    label: 'Which agent or tool are you using?',
    type: 'text',
    required: true,
    options: [],
  },
  {
    id: 'objective',
    label: 'What are you trying to accomplish here?',
    type: 'textarea',
    required: true,
    options: [],
  },
  {
    id: 'task_type',
    label: 'What kind of task is this?',
    type: 'select',
    required: true,
    options: [
      'Research',
      'Compare products',
      'Build an integration',
      'Evaluate a purchase',
      'Monitor changes',
      'Other',
    ],
  },
  {
    id: 'discovery',
    label: 'How did you find this website?',
    type: 'text',
    required: false,
    options: [],
  },
  {
    id: 'actions',
    label: 'Which actions do you need?',
    type: 'multiselect',
    required: true,
    options: ['Read pages', 'Search', 'Download files'],
  },
  {
    id: 'success',
    label: 'What would a successful visit look like?',
    type: 'textarea',
    required: false,
    options: [],
  },
];

export class Store {
  db: DatabaseSync;
  collectorOrigin?: string;
  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    }
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, name TEXT NOT NULL, origin TEXT NOT NULL, require_admission INTEGER NOT NULL DEFAULT 0, questions_version INTEGER NOT NULL, questions TEXT NOT NULL, ingest_hash TEXT);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), token_hash TEXT NOT NULL UNIQUE, external_key TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, user_agent TEXT NOT NULL, ip TEXT NOT NULL, referrer TEXT NOT NULL, entry_path TEXT NOT NULL, agent_name TEXT NOT NULL, classification TEXT NOT NULL, evidence TEXT NOT NULL, environment TEXT NOT NULL DEFAULT '{}', answers TEXT NOT NULL DEFAULT '{}', questions TEXT NOT NULL, questions_version INTEGER NOT NULL, permissions TEXT NOT NULL DEFAULT '[]', UNIQUE(site_id, external_key));
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), created_at TEXT NOT NULL, type TEXT NOT NULL, path TEXT NOT NULL, method TEXT NOT NULL, status INTEGER, source TEXT NOT NULL, data TEXT NOT NULL, dedupe_key TEXT UNIQUE);
      CREATE INDEX IF NOT EXISTS events_session_time ON events(session_id, created_at);
      CREATE INDEX IF NOT EXISTS sessions_created ON sessions(created_at);
      CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
    `);
    if (!this.db.prepare('SELECT id FROM sites LIMIT 1').get())
      this.db
        .prepare(
          'INSERT INTO sites (id,name,origin,questions_version,questions) VALUES (?,?,?,?,?)',
        )
        .run(
          'site_local',
          'Northstar',
          'http://localhost:3000',
          1,
          JSON.stringify(defaultQuestions),
        );
  }
  site(): Site {
    const row = this.db.prepare('SELECT * FROM sites LIMIT 1').get()!;
    return {
      id: String(row.id),
      name: String(row.name),
      origin: String(row.origin),
      requireAdmission: !!row.require_admission,
      questionsVersion: Number(row.questions_version),
      questions: json(row.questions),
      hasIngestKey: !!row.ingest_hash,
      ...(this.collectorOrigin ? { collectorOrigin: this.collectorOrigin } : {}),
    };
  }
  updateSite(update: {
    name: string;
    origin: string;
    requireAdmission: boolean;
    questions: Question[];
  }) {
    const old = this.site();
    this.db
      .prepare(
        'UPDATE sites SET name=?, origin=?, require_admission=?, questions=?, questions_version=? WHERE id=?',
      )
      .run(
        update.name,
        update.origin,
        Number(update.requireAdmission),
        JSON.stringify(update.questions),
        old.questionsVersion + 1,
        old.id,
      );
    return this.site();
  }
  rotateKey() {
    const key = `arr_${credential()}`;
    this.db.prepare('UPDATE sites SET ingest_hash=? WHERE id=?').run(hash(key), this.site().id);
    return key;
  }
  keyValid(key: string) {
    return !!key && !!this.db.prepare('SELECT id FROM sites WHERE ingest_hash=?').get(hash(key));
  }
  createSession(input: {
    source: Visit['source'];
    userAgent: string;
    ip: string;
    referrer: string;
    entryPath: string;
    agentName: string;
    classification: Visit['classification'];
    evidence: Evidence[];
    isDemo?: boolean;
    externalKey?: string;
  }) {
    const site = this.site(),
      id = randomUUID(),
      token = credential(),
      date = now();
    this.db
      .prepare(
        `INSERT INTO sessions (id,site_id,token_hash,external_key,created_at,updated_at,expires_at,status,source,is_demo,user_agent,ip,referrer,entry_path,agent_name,classification,evidence,questions,questions_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        site.id,
        hash(token),
        input.externalKey ?? null,
        date,
        date,
        new Date(Date.now() + 86400000).toISOString(),
        input.source === 'gateway' && site.requireAdmission ? 'awaiting' : 'observed',
        input.source,
        Number(!!input.isDemo),
        input.userAgent,
        input.ip,
        input.referrer,
        input.entryPath,
        input.agentName,
        input.classification,
        JSON.stringify(input.evidence),
        JSON.stringify(site.questions),
        site.questionsVersion,
      );
    return { visit: this.get(id)!, token };
  }
  private map(row: Row): Visit {
    const answers = json<Visit['answers']>(row.answers);
    const counts = this.db
      .prepare(
        "SELECT COUNT(*) AS events, SUM(CASE WHEN type='page_view' THEN 1 ELSE 0 END) AS pages FROM events WHERE session_id=?",
      )
      .get(String(row.id))!;
    const types = this.db
      .prepare('SELECT DISTINCT type FROM events WHERE session_id=?')
      .all(String(row.id));
    const status =
      String(row.status) !== 'revoked' && Date.parse(String(row.expires_at)) <= Date.now()
        ? 'expired'
        : String(row.status);
    return {
      id: String(row.id),
      siteId: String(row.site_id),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      expiresAt: String(row.expires_at),
      status: status as Visit['status'],
      source: String(row.source) as Visit['source'],
      isDemo: !!row.is_demo,
      userAgent: String(row.user_agent),
      ip: String(row.ip),
      referrer: String(row.referrer),
      entryPath: String(row.entry_path),
      agentName:
        typeof answers.agent_name === 'string' ? answers.agent_name : String(row.agent_name),
      classification: String(row.classification) as Visit['classification'],
      evidence: json(row.evidence),
      environment: json(row.environment),
      answers,
      questions: json(row.questions),
      questionsVersion: Number(row.questions_version),
      permissions: json(row.permissions),
      eventCount: Number(counts.events),
      pageCount: Number(counts.pages ?? 0),
      objective: typeof answers.objective === 'string' ? answers.objective : '',
      eventTypes: types.map((r) => String(r.type)),
    };
  }
  get(id: string) {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id=?').get(id);
    return row ? this.map(row) : undefined;
  }
  byToken(token: string) {
    if (!token) return undefined;
    const row = this.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(token));
    return row ? this.map(row) : undefined;
  }
  byExternal(key: string) {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE site_id=? AND external_key=?')
      .get(this.site().id, key);
    return row ? this.map(row) : undefined;
  }
  list(since: string) {
    return this.db
      .prepare('SELECT * FROM sessions WHERE created_at>=? ORDER BY created_at DESC LIMIT 300')
      .all(since)
      .map((r) => this.map(r));
  }
  event(
    id: string,
    type: string,
    path: string,
    data: Record<string, unknown> = {},
    options: { method?: string; status?: number; source?: string; dedupeKey?: string } = {},
  ) {
    const time = now();
    const result = this.db
      .prepare(
        'INSERT OR IGNORE INTO events (id,session_id,created_at,type,path,method,status,source,data,dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        randomUUID(),
        id,
        time,
        type,
        path,
        options.method ?? 'GET',
        options.status ?? null,
        options.source ?? 'server observed',
        JSON.stringify(data),
        options.dedupeKey ?? null,
      );
    if (Number(result.changes) > 0)
      this.db.prepare('UPDATE sessions SET updated_at=? WHERE id=?').run(time, id);
    return Number(result.changes) > 0;
  }
  events(id: string): VisitEvent[] {
    return this.db
      .prepare('SELECT * FROM events WHERE session_id=? ORDER BY created_at, rowid LIMIT 1500')
      .all(id)
      .map((r) => ({
        id: String(r.id),
        sessionId: String(r.session_id),
        createdAt: String(r.created_at),
        type: String(r.type),
        path: String(r.path),
        method: String(r.method),
        status: r.status === null ? null : Number(r.status),
        source: String(r.source),
        data: json(r.data),
      }));
  }
  admit(id: string, answers: Visit['answers'], permissions: string[]) {
    const token = credential();
    this.db
      .prepare(
        "UPDATE sessions SET answers=?, permissions=?, status='admitted', token_hash=?, expires_at=? WHERE id=?",
      )
      .run(
        JSON.stringify(answers),
        JSON.stringify(permissions),
        hash(token),
        new Date(Date.now() + 3600000).toISOString(),
        id,
      );
    this.event(
      id,
      'check_in',
      '/api/agent/check-in',
      {
        questionVersion: this.get(id)!.questionsVersion,
        permissions,
        identity: 'self-reported, unverified',
      },
      { method: 'POST', status: 200 },
    );
    return token;
  }
  revoke(id: string) {
    this.db.prepare("UPDATE sessions SET status='revoked' WHERE id=?").run(id);
    this.event(id, 'access_revoked', '/', {}, { source: 'owner action' });
  }
  declare(id: string, answers: Visit['answers'], source = 'browser reported') {
    this.db
      .prepare("UPDATE sessions SET answers=?, status='observed', permissions='[]' WHERE id=?")
      .run(JSON.stringify(answers), id);
    this.event(
      id,
      'purpose_declared',
      this.get(id)!.entryPath,
      { questionVersion: this.get(id)!.questionsVersion, enforced: false },
      { method: 'POST', source, status: 200 },
    );
  }
  environment(
    id: string,
    environment: Record<string, unknown>,
    source: 'browser reported' | 'agent reported' = 'browser reported',
  ) {
    const visit = this.get(id)!;
    const evidence = visit.evidence.filter((e) => e.source !== source);
    for (const [name, value] of Object.entries(environment))
      if (value !== undefined && value !== null)
        evidence.push({
          name,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          source,
        });
    const automation =
      environment.webdriver === true || /HeadlessChrome/i.test(String(environment.userAgent ?? ''));
    this.db
      .prepare('UPDATE sessions SET environment=?, evidence=?, classification=? WHERE id=?')
      .run(
        JSON.stringify(environment),
        JSON.stringify(evidence),
        automation && visit.classification === 'unknown'
          ? 'automation signals'
          : visit.classification,
        id,
      );
  }
  close() {
    this.db.close();
  }
}
