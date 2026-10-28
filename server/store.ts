import { AsyncLocalStorage } from 'node:async_hooks';
import type { SQLInputValue } from 'node:sqlite';
import { Database } from './database.ts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Evidence, Question, Site, Visit, VisitEvent, NetworkContext } from '../src/types.ts';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const credential = () => randomBytes(32).toString('base64url');
const now = () => new Date().toISOString();
const json = <T>(value: unknown): T => JSON.parse(String(value));
type Row = Record<string, unknown>;
const sessionSelect = `SELECT s.*,
 (SELECT COUNT(*) FROM events e WHERE e.session_id=s.id) AS event_count,
 (SELECT COUNT(*) FROM events e WHERE e.session_id=s.id AND e.type='page_view') AS page_count,
 (SELECT json_group_array(DISTINCT type) FROM events e WHERE e.session_id=s.id) AS event_types
 FROM sessions s`;
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
  db: Database;
  private context = new AsyncLocalStorage<string>();
  get siteId() {
    return this.context.getStore() ?? 'site_local';
  }
  withSite<T>(siteId: string, work: () => T): T {
    return this.context.run(siteId, work);
  }
  scoped(sql: string) {
    const filter = /\bFROM events\b/i.test(sql)
      ? 'session_id IN (SELECT id FROM sessions WHERE site_id=?)'
      : 'site_id=?';
    const match = /\b(GROUP BY|ORDER BY|LIMIT)\b/i.exec(sql);
    const split = match?.index ?? sql.length;
    const before = sql.slice(0, split),
      after = sql.slice(split);
    const query = before + (/\bWHERE\b/i.test(before) ? ' AND ' : ' WHERE ') + filter + ' ' + after;
    return {
      get: (...args: SQLInputValue[]) => this.db.prepare(query).get(...args, this.siteId),
      all: (...args: SQLInputValue[]) => this.db.prepare(query).all(...args, this.siteId),
    };
  }
  readonly ready: Promise<void>;
  collectorOrigin?: string;
  constructor(
    path: string,
    connection?: {
      url: string;
      authToken: string;
    },
  ) {
    if (!connection && path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    }
    this.db = new Database(path, connection);
    if (!connection && path !== ':memory:') chmodSync(path, 0o600);
    this.ready = this.initialize();
  }
  private async initialize() {
    if (!this.db.remote)
      await this.db.exec(
        'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
      );
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, name TEXT NOT NULL, origin TEXT NOT NULL, require_admission INTEGER NOT NULL DEFAULT 0, questions_version INTEGER NOT NULL, questions TEXT NOT NULL, ingest_hash TEXT);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), token_hash TEXT NOT NULL UNIQUE, external_key TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, user_agent TEXT NOT NULL, ip TEXT NOT NULL, referrer TEXT NOT NULL, entry_path TEXT NOT NULL, agent_name TEXT NOT NULL, classification TEXT NOT NULL, evidence TEXT NOT NULL, environment TEXT NOT NULL DEFAULT '{}', answers TEXT NOT NULL DEFAULT '{}', questions TEXT NOT NULL, questions_version INTEGER NOT NULL, permissions TEXT NOT NULL DEFAULT '[]', network TEXT NOT NULL DEFAULT '{}', UNIQUE(site_id, external_key));
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), created_at TEXT NOT NULL, type TEXT NOT NULL, path TEXT NOT NULL, method TEXT NOT NULL, status INTEGER, source TEXT NOT NULL, data TEXT NOT NULL, dedupe_key TEXT UNIQUE);
      CREATE INDEX IF NOT EXISTS events_session_time ON events(session_id, created_at);
      CREATE INDEX IF NOT EXISTS sessions_created ON sessions(created_at);
      CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL, site_id TEXT NOT NULL DEFAULT 'site_local');
      CREATE TABLE IF NOT EXISTS workspaces (site_id TEXT PRIMARY KEY REFERENCES sites(id), slug TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entry_challenges (token_hash TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), site_id TEXT NOT NULL REFERENCES sites(id), expires_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS entry_challenges_expiry ON entry_challenges(expires_at);
      CREATE TABLE IF NOT EXISTS entry_policies (site_id TEXT PRIMARY KEY REFERENCES sites(id), mode TEXT NOT NULL DEFAULT 'ask', message TEXT NOT NULL DEFAULT 'A quick introduction, then back to your task.');
    `);
    if (
      !(await this.db.prepare('PRAGMA table_info(sessions)').all()).some(
        (column) => column.name === 'network',
      )
    )
      try {
        await this.db.exec("ALTER TABLE sessions ADD COLUMN network TEXT NOT NULL DEFAULT '{}'");
      } catch (error) {
        if (
          !(await this.db.prepare('PRAGMA table_info(sessions)').all()).some(
            (c) => c.name === 'network',
          )
        )
          throw error;
      }
    if (
      !(await this.db.prepare('PRAGMA table_info(admin_sessions)').all()).some(
        (c) => c.name === 'site_id',
      )
    ) {
      try {
        await this.db.exec(
          "ALTER TABLE admin_sessions ADD COLUMN site_id TEXT NOT NULL DEFAULT 'site_local'",
        );
      } catch (error) {
        if (
          !(await this.db.prepare('PRAGMA table_info(admin_sessions)').all()).some(
            (c) => c.name === 'site_id',
          )
        )
          throw error;
      }
    }
    if (!(await this.db.prepare('SELECT id FROM sites LIMIT 1').get()))
      await this.db
        .prepare(
          'INSERT OR IGNORE INTO sites (id,name,origin,questions_version,questions) VALUES (?,?,?,?,?)',
        )
        .run(
          'site_local',
          'Northstar',
          'http://localhost:3000',
          1,
          JSON.stringify(defaultQuestions),
        );
  }
  async site(): Promise<Site> {
    await this.ready;
    const row = (await this.db
      .prepare(
        'SELECT s.*,w.slug,p.mode AS entry_mode,p.message AS entry_message FROM sites s LEFT JOIN workspaces w ON w.site_id=s.id LEFT JOIN entry_policies p ON p.site_id=s.id WHERE s.id=?',
      )
      .get(this.siteId))!;
    return {
      workspace: row.slug ? String(row.slug) : undefined,
      entryMode: row.entry_mode ? (String(row.entry_mode) as 'ask' | 'observe') : 'observe',
      entryMessage: String(row.entry_message ?? 'A quick introduction, then back to your task.'),
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
  async updateSite(update: {
    name: string;
    origin: string;
    requireAdmission: boolean;
    questions: Question[];
  }) {
    await this.ready;
    const old = await this.site();
    await this.db
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
    return await this.site();
  }
  async rotateKey() {
    await this.ready;
    const key = `arr_${credential()}`;
    await this.db
      .prepare('UPDATE sites SET ingest_hash=? WHERE id=?')
      .run(hash(key), (await this.site()).id);
    return key;
  }
  async keyValid(key: string) {
    await this.ready;
    return (
      !!key &&
      !!(await this.db
        .prepare('SELECT id FROM sites WHERE ingest_hash=? AND id=?')
        .get(hash(key), this.siteId))
    );
  }
  async createSession(input: {
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
    await this.ready;
    const site = await this.site(),
      id = randomUUID(),
      token = credential(),
      date = now();
    const inserted = await this.db
      .prepare(
        `INSERT OR IGNORE INTO sessions (id,site_id,token_hash,external_key,created_at,updated_at,expires_at,status,source,is_demo,user_agent,ip,referrer,entry_path,agent_name,classification,evidence,questions,questions_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
    if (!inserted.changes) {
      const existing = input.externalKey ? await this.byExternal(input.externalKey) : undefined;
      if (!existing) throw new Error('Could not create visit.');
      return { visit: existing, token: '' };
    }
    return { visit: (await this.get(id))!, token };
  }
  private async map(row: Row): Promise<Visit> {
    await this.ready;
    const answers = json<Visit['answers']>(row.answers);
    const counts = { events: row.event_count ?? 0, pages: row.page_count ?? 0 };
    const types = row.event_types ? json<string[]>(row.event_types) : [];
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
      network:
        row.network && String(row.network) !== '{}' ? json<NetworkContext>(row.network) : undefined,
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
      eventTypes: types,
    };
  }
  async get(id: string) {
    await this.ready;
    const row = await this.db
      .prepare(`${sessionSelect} WHERE s.id=? AND s.site_id=?`)
      .get(id, this.siteId);
    return row ? await this.map(row) : undefined;
  }
  async network(id: string, context: NetworkContext) {
    await this.ready;
    // Compare-and-swap prevents concurrent requests losing the address history.
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = await this.db
        .prepare('SELECT network FROM sessions WHERE id=? AND site_id=?')
        .get(id, this.siteId);
      if (!row) return;
      const previous = json<Partial<NetworkContext>>(row.network);
      if (previous.observedAt && previous.observedAt > context.observedAt) return;
      const changed = !!previous.ip && previous.ip !== context.ip;
      const history = [...(previous.history ?? [])];
      if (context.ip && (!previous.ip || changed))
        history.push({ ip: context.ip, observedAt: context.observedAt, source: context.ipSource });
      const result = await this.db
        .prepare('UPDATE sessions SET network=? WHERE id=? AND network=? AND site_id=?')
        .run(
          JSON.stringify({ ...context, history: history.slice(-8) }),
          id,
          String(row.network),
          this.siteId,
        );
      if (!result.changes) continue;
      if (changed)
        await this.event(
          id,
          'network_changed',
          '/',
          { previousIp: previous.ip, ip: context.ip },
          {
            source:
              context.ipSource === 'integration reported'
                ? 'integration reported'
                : 'server observed',
          },
        );
      return;
    }
  }
  async entryChallenge(id: string) {
    const token = credential();
    await this.db.prepare('DELETE FROM entry_challenges WHERE expires_at<?').run(now());
    await this.db
      .prepare(
        'INSERT INTO entry_challenges(token_hash,session_id,site_id,expires_at) SELECT ?,?,?,? WHERE EXISTS(SELECT id FROM sessions WHERE id=? AND site_id=?)',
      )
      .run(
        hash(token),
        id,
        this.siteId,
        new Date(Date.now() + 15 * 60000).toISOString(),
        id,
        this.siteId,
      );
    return token;
  }
  async entryByChallenge(token: string) {
    const row = await this.db
      .prepare(
        'SELECT session_id FROM entry_challenges WHERE token_hash=? AND site_id=? AND expires_at>?',
      )
      .get(hash(token), this.siteId, now());
    return row ? this.get(String(row.session_id)) : undefined;
  }
  async declareOnce(id: string, answers: Visit['answers']) {
    const updated = await this.db
      .prepare(
        "UPDATE sessions SET answers=?,status='observed',permissions='[]' WHERE id=? AND site_id=? AND answers='{}'",
      )
      .run(JSON.stringify(answers), id, this.siteId);
    if (updated.changes)
      await this.event(
        id,
        'purpose_declared',
        (await this.get(id))!.entryPath,
        { enforced: true },
        { method: 'POST', source: 'agent reported' },
      );
    return !!updated.changes;
  }
  async byToken(token: string) {
    await this.ready;
    if (!token) return undefined;
    const row = await this.db
      .prepare(`${sessionSelect} WHERE s.token_hash=? AND s.site_id=?`)
      .get(hash(token), this.siteId);
    return row ? await this.map(row) : undefined;
  }
  async byExternal(key: string) {
    await this.ready;
    const row = await this.db
      .prepare(`${sessionSelect} WHERE s.site_id=? AND s.external_key=?`)
      .get((await this.site()).id, key);
    return row ? await this.map(row) : undefined;
  }
  async list(since: string) {
    await this.ready;
    return Promise.all(
      (
        await this.db
          .prepare(
            `${sessionSelect} WHERE s.created_at>=? AND s.site_id=? ORDER BY s.created_at DESC LIMIT 300`,
          )
          .all(since, this.siteId)
      ).map((r) => this.map(r)),
    );
  }
  async event(
    id: string,
    type: string,
    path: string,
    data: Record<string, unknown> = {},
    options: {
      method?: string;
      status?: number;
      source?: string;
      dedupeKey?: string;
    } = {},
  ) {
    await this.ready;
    const time = now();
    const result = await this.db
      .prepare(
        'INSERT OR IGNORE INTO events (id,session_id,created_at,type,path,method,status,source,data,dedupe_key) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE id=? AND site_id=?)',
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
        id,
        this.siteId,
      );
    if (Number(result.changes) > 0)
      await this.db
        .prepare('UPDATE sessions SET updated_at=? WHERE id=? AND site_id=?')
        .run(time, id, this.siteId);
    return Number(result.changes) > 0;
  }
  async events(id: string): Promise<VisitEvent[]> {
    await this.ready;
    return (
      await this.db
        .prepare(
          'SELECT * FROM events WHERE session_id=? AND session_id IN (SELECT id FROM sessions WHERE site_id=?) ORDER BY created_at, rowid LIMIT 1500',
        )
        .all(id, this.siteId)
    ).map((r) => ({
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
  async admit(id: string, answers: Visit['answers'], permissions: string[]) {
    await this.ready;
    const token = credential();
    await this.db
      .prepare(
        "UPDATE sessions SET answers=?, permissions=?, status='admitted', token_hash=?, expires_at=? WHERE id=? AND site_id=?",
      )
      .run(
        JSON.stringify(answers),
        JSON.stringify(permissions),
        hash(token),
        new Date(Date.now() + 3600000).toISOString(),
        id,
        this.siteId,
      );
    await this.event(
      id,
      'check_in',
      '/api/agent/check-in',
      {
        questionVersion: (await this.get(id))!.questionsVersion,
        permissions,
        identity: 'self-reported, unverified',
      },
      { method: 'POST', status: 200 },
    );
    return token;
  }
  async revoke(id: string) {
    await this.ready;
    await this.db
      .prepare("UPDATE sessions SET status='revoked' WHERE id=? AND site_id=?")
      .run(id, this.siteId);
    await this.event(id, 'access_revoked', '/', {}, { source: 'owner action' });
  }
  async declare(id: string, answers: Visit['answers'], source = 'browser reported') {
    await this.ready;
    await this.db
      .prepare(
        "UPDATE sessions SET answers=?, status='observed', permissions='[]' WHERE id=? AND site_id=?",
      )
      .run(JSON.stringify(answers), id, this.siteId);
    await this.event(
      id,
      'purpose_declared',
      (await this.get(id))!.entryPath,
      { questionVersion: (await this.get(id))!.questionsVersion, enforced: false },
      { method: 'POST', source, status: 200 },
    );
  }
  async environment(
    id: string,
    environment: Record<string, unknown>,
    source: 'browser reported' | 'agent reported' = 'browser reported',
  ) {
    const visit = (await this.get(id))!;
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
    await this.db
      .prepare(
        'UPDATE sessions SET environment=?, evidence=?, classification=? WHERE id=? AND site_id=?',
      )
      .run(
        JSON.stringify(environment),
        JSON.stringify(evidence),
        automation && visit.classification === 'unknown'
          ? 'automation signals'
          : visit.classification,
        id,
        this.siteId,
      );
  }
  close() {
    this.db.close();
  }
}
