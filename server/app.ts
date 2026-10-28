import { providerRanges } from './provider-ranges.ts';
import express, { type Request, type Response, type NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { Store, credential, hash } from './store.ts';
import { cleanPath, cleanReferrer, identify } from './signals.ts';
import { installEntry } from './entry.ts';
import { createWorkspace, passwordMatches } from './workspaces.ts';
import { NetworkEnricher } from './geo.ts';
import { addressInfo, captureNetwork, reportedNetwork } from './network.ts';
import { catalog, gatePage, labPage, checkInPage } from './pages.ts';
import type { Question, Visit } from '../src/types.ts';
const text = (max = 2000) => z.string().trim().max(max);
const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{1,60}$/),
    label: text(180).min(3),
    type: z.enum(['text', 'textarea', 'select', 'multiselect']),
    required: z.boolean(),
    options: z.array(text(160).min(1)).max(12),
  })
  .strict();
const configSchema = z
  .object({
    name: text(80).min(1),
    origin: z
      .url()
      .refine(
        (v) => ['http:', 'https:'].includes(new URL(v).protocol),
        'Use an HTTP or HTTPS origin.',
      )
      .transform((v) => new URL(v).origin),
    requireAdmission: z.boolean(),
    entryMode: z.enum(['ask', 'observe']).optional(),
    entryMessage: text(240).optional(),
    questions: z.array(questionSchema).min(1).max(20),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.questions.map((q) => q.id)).size !== v.questions.length)
      ctx.addIssue({ code: 'custom', message: 'Question IDs must be unique.' });
    for (const q of v.questions)
      if (
        (q.type === 'select' || q.type === 'multiselect') &&
        (q.options.length < 1 || new Set(q.options).size !== q.options.length)
      )
        ctx.addIssue({ code: 'custom', message: `“${q.label}” needs unique, non-empty options.` });
  });
const environmentSchema = z
  .object({
    userAgent: text(700).optional(),
    webdriver: z.boolean().optional(),
    language: text(50).optional(),
    languages: z.array(text(50)).max(10).optional(),
    timezone: text(100).optional(),
    platform: text(80).optional(),
    viewport: text(40).optional(),
    screen: text(40).optional(),
    hardwareConcurrency: z.number().min(0).max(2048).optional(),
    deviceMemory: z.number().min(0).max(1024).optional(),
    touchPoints: z.number().min(0).max(100).optional(),
    cookiesEnabled: z.boolean().optional(),
    colorScheme: z.enum(['light', 'dark']).optional(),
    pixelRatio: z.number().min(0).max(20).optional(),
    colorDepth: z.number().min(0).max(128).optional(),
    browserBrands: z.array(text(100)).max(10).optional(),
    mobile: z.boolean().optional(),
    connectionType: text(40).optional(),
    downlinkMbps: z.number().min(0).max(100000).optional(),
    roundTripMs: z.number().min(0).max(600000).optional(),
    saveData: z.boolean().optional(),
    doNotTrack: text(20).optional(),
    globalPrivacyControl: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
  })
  .strict();
const eventSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(['click', 'scroll', 'visibility', 'page_view']),
    path: text(700),
    label: text(180).optional(),
    depth: z.number().min(0).max(100).optional(),
    state: z.enum(['visible', 'hidden']).optional(),
  })
  .strict();
const cookies = (req: Request): Record<string, string> =>
  Object.fromEntries(
    (req.headers.cookie ?? '').split(';').flatMap((c) => {
      const i = c.indexOf('=');
      return i < 0 ? [] : [[c.slice(0, i).trim(), c.slice(i + 1).trim()]];
    }),
  );
const bearer = (req: Request) =>
  /^Bearer ([A-Za-z0-9_-]{20,120})$/.exec(req.get('authorization') ?? '')?.[1] ?? '';
const sessionToken = (req: Request) => bearer(req) || cookies(req).arrival_visit || '';
const isLoopback = (ip?: string) => !!ip && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
const ownOrigin = (req: Request) => {
  try {
    const origin = req.get('origin');
    return !origin || new URL(origin).origin === `${req.protocol}://${req.get('host')}`;
  } catch {
    return false;
  }
};
const freshRequest = (req: Request, res: Response, next: NextFunction) => {
  if (!ownOrigin(req) || req.get('sec-fetch-site') === 'cross-site') {
    res.status(403).json({ error: 'This action must originate from this dashboard.' });
    return;
  }
  next();
};
const setVisitCookie = (req: Request, res: Response, token: string) =>
  res.cookie('arrival_visit', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    path: '/',
    maxAge: 86400000,
  });
const validate = <T>(schema: z.ZodType<T>, body: unknown, res: Response): T | undefined => {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(422).json({ error: result.error.issues[0]?.message ?? 'Invalid request.' });
    return;
  }
  return result.data;
};
function answerErrors(questions: Question[], answers: Visit['answers']) {
  const fields: Record<string, string> = {};
  for (const key of Object.keys(answers))
    if (!questions.some((q) => q.id === key)) fields[key] = 'Unknown question.';
  for (const q of questions) {
    const value = answers[q.id];
    if (
      q.required &&
      (value === undefined || (typeof value === 'string' ? !value.trim() : !value.length))
    ) {
      fields[q.id] = 'Please answer this question.';
      continue;
    }
    if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) continue;
    if (q.type === 'multiselect') {
      if (
        !Array.isArray(value) ||
        new Set(value).size !== value.length ||
        value.some((v) => !q.options.includes(v))
      )
        fields[q.id] = 'Choose from the available options.';
    } else if (typeof value !== 'string') fields[q.id] = 'Enter a text answer.';
    else if (q.type === 'select' && !q.options.includes(value))
      fields[q.id] = 'Choose from the available options.';
  }
  return fields;
}
export async function createApp(
  options: {
    refreshProviderRanges?: boolean;
    databasePath?: string;
    adminPassword?: string;
    trustedProxy?: string | number;
    publicOrigin?: string;
    networkService?: NetworkEnricher;
    databaseConnection?: {
      url: string;
      authToken: string;
    };
    backfillOnStart?: boolean;
  } = {},
) {
  const store = new Store(
    options.databasePath ?? resolve('.data/arrival.sqlite'),
    options.databaseConnection,
  );
  await store.ready;
  const network = options.networkService ?? new NetworkEnricher();
  const refreshNetworkArchive = async () => {
    let updated = 0;
    for (const visit of await store.list('1970')) {
      const context = visit.network;
      await store.network(
        visit.id,
        context
          ? {
              ...context,
              location: undefined,
              asn: undefined,
              hosting: undefined,
              ...network.lookup(context.ip),
            }
          : reportedNetwork(visit.ip, network.lookup, {}, true),
      );
      updated++;
    }
    return updated;
  };
  if (network.status().enabled && options.backfillOnStart !== false) await refreshNetworkArchive();
  if (options.publicOrigin) {
    const url = new URL(options.publicOrigin);
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('PUBLIC_URL must be an HTTP(S) URL.');
    store.collectorOrigin = url.origin;
  }
  const app = express();
  app.disable('x-powered-by');
  if (options.trustedProxy) app.set('trust proxy', options.trustedProxy);
  app.use(express.json({ limit: '64kb' }));
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    });
    next();
  });
  app.use(async (req, res, next) => {
    let siteId = 'site_local';
    const publicMatch =
      /^\/(?:api\/(?:collect|agent\/collect|agent\/manifest|entry\/policy)|check-in)\/([a-zA-Z0-9_-]+)(?:\/|$)/.exec(
        req.path,
      );
    if (publicMatch) siteId = publicMatch[1];
    else if (req.path === '/api/ingest' || req.path.startsWith('/api/entry/')) {
      const row = await store.db
        .prepare('SELECT id FROM sites WHERE ingest_hash=?')
        .get(hash(bearer(req)));
      if (row) siteId = String(row.id);
    } else {
      const row = await store.db
        .prepare('SELECT site_id FROM admin_sessions WHERE token_hash=? AND expires_at>?')
        .get(hash(cookies(req).arrival_owner ?? ''), new Date().toISOString());
      if (row) siteId = String(row.site_id);
    }
    if (!(await store.db.prepare('SELECT id FROM sites WHERE id=?').get(siteId))) {
      res.status(404).json({ error: 'Workspace not found.' });
      return;
    }
    store.withSite(siteId, () => next());
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const limits = new Map<
    string,
    {
      count: number;
      reset: number;
    }
  >();
  function rateLimit(prefix: string, max: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = `${prefix}:${req.ip}`,
        time = Date.now();
      if (limits.size > 5000) for (const [k, v] of limits) if (v.reset < time) limits.delete(k);
      let item = limits.get(key);
      if (!item || item.reset < time) {
        item = { count: 0, reset: time + 60000 };
        limits.set(key, item);
      }
      if (++item.count > max) {
        res
          .set('Retry-After', '60')
          .status(429)
          .json({ error: 'Too many requests. Try again in a minute.' });
        return;
      }
      next();
    };
  }
  async function owner(req: Request, res: Response, next: NextFunction) {
    const token = cookies(req).arrival_owner;
    if (
      !token ||
      !(await store.db
        .prepare('SELECT 1 FROM admin_sessions WHERE token_hash=? AND expires_at>? AND site_id=?')
        .get(hash(token), new Date().toISOString(), store.siteId))
    ) {
      res.status(401).json({ error: 'Sign in to access the dashboard.' });
      return;
    }
    next();
  }
  async function ownerSession(req: Request, res: Response) {
    const token = credential();
    await store.db
      .prepare('DELETE FROM admin_sessions WHERE expires_at<?')
      .run(new Date().toISOString());
    await store.db
      .prepare('INSERT INTO admin_sessions(token_hash,expires_at,site_id) VALUES (?,?,?)')
      .run(hash(token), new Date(Date.now() + 28800000).toISOString(), store.siteId);
    res.cookie('arrival_owner', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure,
      maxAge: 28800000,
      path: '/',
    });
  }
  installEntry(app, store, network, answerErrors);
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'arrival' }));
  app.post('/api/auth/local', freshRequest, rateLimit('auth', 15), async (req, res) => {
    let localHost = false;
    try {
      localHost = ['localhost', '127.0.0.1', '[::1]'].includes(
        new URL(`http://${req.get('host')}`).hostname,
      );
    } catch {
      /* invalid host */
    }
    if (options.adminPassword || !isLoopback(req.socket.remoteAddress) || !localHost) {
      res.status(401).json({ error: 'An owner password is required.', requiresPassword: true });
      return;
    }
    await ownerSession(req, res);
    res.json({ ok: true, mode: 'local-only' });
  });
  app.post('/api/auth/login', freshRequest, rateLimit('auth', 15), async (req, res) => {
    const body = validate(
      z.object({ password: text(256), workspace: text(80).optional() }).strict(),
      req.body,
      res,
    );
    if (!body) return;
    if (body.workspace) {
      const workspace = await store.db
        .prepare('SELECT site_id,password_hash FROM workspaces WHERE slug=?')
        .get(body.workspace);
      if (!workspace || !(await passwordMatches(body.password, String(workspace.password_hash)))) {
        res.status(401).json({ error: 'Workspace or password did not match.' });
        return;
      }
      await store.withSite(String(workspace.site_id), () => ownerSession(req, res));
      res.json({ ok: true });
      return;
    }
    if (
      !options.adminPassword ||
      !timingSafeEqual(Buffer.from(hash(body.password)), Buffer.from(hash(options.adminPassword)))
    ) {
      res.status(401).json({ error: 'The password did not match.' });
      return;
    }
    await ownerSession(req, res);
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', freshRequest, async (req, res) => {
    await store.db
      .prepare('DELETE FROM admin_sessions WHERE token_hash=?')
      .run(hash(cookies(req).arrival_owner ?? ''));
    res.clearCookie('arrival_owner');
    res.json({ ok: true });
  });
  app.post('/api/auth/register', freshRequest, rateLimit('register', 5), async (req, res) => {
    const body = validate(
      z
        .object({
          name: text(80).min(1),
          origin: z.url().max(700),
          slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,47}$/),
          password: z.string().min(12).max(256),
        })
        .strict(),
      req.body,
      res,
    );
    if (!body) return;
    if (!['http:', 'https:'].includes(new URL(body.origin).protocol)) {
      res.status(422).json({ error: 'Use a website HTTP or HTTPS origin.' });
      return;
    }
    if (await store.db.prepare('SELECT site_id FROM workspaces WHERE slug=?').get(body.slug)) {
      res.status(409).json({ error: 'That workspace address is already in use.' });
      return;
    }
    const created = await createWorkspace(store, body);
    await store.withSite(created.site.id, () => ownerSession(req, res));
    res.status(201).json(created);
  });
  app.get('/api/workspaces/:slug', async (req, res) => {
    const row = await store.db
      .prepare(
        'SELECT s.name,w.slug FROM workspaces w JOIN sites s ON s.id=w.site_id WHERE w.slug=?',
      )
      .get(String(req.params.slug));
    if (!row) {
      res.status(404).json({ error: 'Workspace not found.' });
      return;
    }
    res.json(row);
  });
  app.use('/api/admin', freshRequest, owner);
  app.get('/api/admin/site', async (_req, res) => res.json(await store.site()));
  app.get('/api/admin/network', (_req, res) => res.json(network.status()));
  app.post('/api/admin/network/update', rateLimit('geo-update', 3), (_req, res) => {
    if (network.readOnly) {
      res.status(405).json({ error: 'IP datasets are updated during deployment.' });
      return;
    }
    void network
      .update()
      .then(async () => {
        if (network.status().enabled) await refreshNetworkArchive();
      })
      .catch(() => {});
    res.status(202).json(network.status());
  });
  app.post('/api/admin/network/backfill', async (_req, res) =>
    res.json({ updated: await refreshNetworkArchive(), status: network.status() }),
  );
  app.get('/api/admin/installation', async (_req, res) => {
    const browser = await store
      .scoped(
        "SELECT MAX(created_at) AS lastSeen, COUNT(DISTINCT session_id) AS visits FROM events WHERE type='page_view' AND source='browser reported' AND json_extract(data,'$.origin')=?",
      )
      .get((await store.site()).origin);
    const server = await store
      .scoped(
        "SELECT MAX(updated_at) AS lastSeen, COUNT(*) AS visits FROM sessions WHERE source='server'",
      )
      .get();
    res.json({ browser, server });
  });
  app.put('/api/admin/site', async (req, res) => {
    const body = validate(configSchema, req.body, res);
    if (!body) return;
    await store.updateSite({ ...body, origin: new URL(body.origin).origin });
    if (body.entryMode)
      await store.db
        .prepare(
          'INSERT INTO entry_policies(site_id,mode,message) VALUES(?,?,?) ON CONFLICT(site_id) DO UPDATE SET mode=excluded.mode,message=excluded.message',
        )
        .run(
          store.siteId,
          body.entryMode,
          body.entryMessage ?? 'A quick introduction, then back to your task.',
        );
    res.json(await store.site());
  });
  app.post('/api/admin/ingest-key', async (_req, res) =>
    res.json({ key: await store.rotateKey() }),
  );
  app.get('/api/admin/overview', async (req, res) => {
    if (options.refreshProviderRanges) await providerRanges.refresh();
    const range = req.query.range === '7d' ? '7d' : req.query.range === 'all' ? 'all' : '24h';
    const since =
      range === 'all'
        ? '1970'
        : new Date(Date.now() - (range === '7d' ? 7 : 1) * 86400000).toISOString();
    const sessions = await store.list(since);
    const stat = (await store
      .scoped(
        `SELECT COUNT(*) AS visits, SUM(CASE WHEN status='admitted' AND expires_at>? THEN 1 ELSE 0 END) AS admitted, SUM(CASE WHEN answers!='{}' THEN 1 ELSE 0 END) AS answered, SUM(CASE WHEN classification!='unknown' THEN 1 ELSE 0 END) AS automated, SUM(is_demo) AS demo FROM sessions WHERE created_at>=?`,
      )
      .get(new Date().toISOString(), since))!;
    const totalEvents = (await store
      .scoped('SELECT COUNT(*) AS n FROM events WHERE created_at>=?')
      .get(since))!;
    const chart: {
      time: string;
      visits: number;
      events: number;
      clients: Record<string, { visits: number; events: number }>;
    }[] = [];
    const hourly = range === '24h';
    const step = hourly ? 3600000 : 86400000;
    const start = Math.floor((Date.now() - (hourly ? 23 : 6) * step) / step) * step;
    const buckets = await store
      .scoped(
        `SELECT substr(created_at,1,${hourly ? 13 : 10}) AS bucket, (SELECT user_agent FROM sessions WHERE sessions.id=events.session_id) AS client, COUNT(*) AS n FROM events WHERE created_at>=? GROUP BY bucket,client`,
      )
      .all(new Date(start).toISOString());
    const visitBuckets = await store
      .scoped(
        `SELECT substr(created_at,1,${hourly ? 13 : 10}) AS bucket, user_agent AS client, COUNT(*) AS n FROM sessions WHERE created_at>=? GROUP BY bucket,client`,
      )
      .all(new Date(start).toISOString());
    for (let i = 0; i < (hourly ? 24 : 7); i++) {
      const time = new Date(start + i * step).toISOString(),
        key = time.slice(0, hourly ? 13 : 10);
      const clients: Record<string, { visits: number; events: number }> = Object.create(null);
      for (const b of visitBuckets.filter((b) => b.bucket === key)) {
        const client = identify(String(b.client), '').agentName;
        clients[client] ??= { visits: 0, events: 0 };
        clients[client].visits += Number(b.n);
      }
      for (const b of buckets.filter((b) => b.bucket === key)) {
        const client = identify(String(b.client), '').agentName;
        clients[client] ??= { visits: 0, events: 0 };
        clients[client].events += Number(b.n);
      }
      chart.push({
        time,
        clients,
        visits: Object.values(clients).reduce((n, c) => n + c.visits, 0),
        events: Object.values(clients).reduce((n, c) => n + c.events, 0),
      });
    }
    const pages = await store
      .scoped(
        "SELECT path, COUNT(*) AS count FROM events WHERE type IN ('page_view','request') AND created_at>=? GROUP BY path ORDER BY count DESC LIMIT 6",
      )
      .all(since);
    const sourceRows = await store
      .scoped(
        'SELECT user_agent AS userAgent, classification, COUNT(*) AS count FROM sessions WHERE created_at>=? GROUP BY user_agent,classification',
      )
      .all(since);
    const sourceCounts = new Map<string, number>();
    let automated = 0;
    for (const row of sourceRows) {
      const client = identify(String(row.userAgent), '');
      const name = client.agentName;
      if (client.classification !== 'unknown' || row.classification !== 'unknown')
        automated += Number(row.count);
      sourceCounts.set(name, (sourceCounts.get(name) ?? 0) + Number(row.count));
    }
    const sources = [...sourceCounts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const networkCounts = (await store
      .scoped(
        `SELECT COUNT(DISTINCT json_extract(network,'$.location.countryCode')) AS countryCount,
      SUM(CASE WHEN json_extract(network,'$.location.countryCode') IS NOT NULL THEN 1 ELSE 0 END) AS located,
      SUM(CASE WHEN json_extract(network,'$.asn.number') IS NOT NULL THEN 1 ELSE 0 END) AS asnResolved,
      SUM(CASE WHEN json_extract(network,'$.scope')='public' THEN 1 ELSE 0 END) AS publicAddresses
      FROM sessions WHERE created_at>=?`,
      )
      .get(since))!;
    const countries = await store
      .scoped(
        `SELECT json_extract(network,'$.location.countryCode') AS code,
      json_extract(network,'$.location.country') AS name, COUNT(*) AS count FROM sessions
      WHERE created_at>=? AND json_extract(network,'$.location.countryCode') IS NOT NULL GROUP BY code ORDER BY count DESC LIMIT 6`,
      )
      .all(since);
    const providers = await store
      .scoped(
        `SELECT json_extract(network,'$.asn.organization') AS name, COUNT(*) AS count FROM sessions
      WHERE created_at>=? AND json_extract(network,'$.asn.organization') IS NOT NULL GROUP BY name ORDER BY count DESC LIMIT 6`,
      )
      .all(since);
    const regions = await store
      .scoped(
        `SELECT json_extract(network,'$.location.countryCode') AS countryCode, json_extract(network,'$.location.region') AS name, COUNT(*) AS count FROM sessions WHERE created_at>=? AND json_extract(network,'$.location.region') IS NOT NULL GROUP BY countryCode,name ORDER BY count DESC LIMIT 30`,
      )
      .all(since);
    const entry = await store
      .scoped(
        `SELECT COUNT(DISTINCT CASE WHEN type='entry_presented' THEN session_id END) AS prompted,COUNT(DISTINCT CASE WHEN type='entry_answered' THEN session_id END) AS answered,COUNT(DISTINCT CASE WHEN type='entry_continued' THEN session_id END) AS continued FROM events WHERE created_at>=?`,
      )
      .get(since);
    res.json({
      site: await store.site(),
      sessions,
      total: Number(stat.visits),
      stats: {
        visits: Number(stat.visits),
        admitted: Number(stat.admitted ?? 0),
        answered: Number(stat.answered ?? 0),
        events: Number(totalEvents.n),
        automated,
        demo: Number(stat.demo ?? 0),
      },
      entry: {
        prompted: Number(entry?.prompted ?? 0),
        answered: Number(entry?.answered ?? 0),
        continued: Number(entry?.continued ?? 0),
      },
      chart,
      pages,
      sources,
      network: {
        countryCount: Number(networkCounts.countryCount ?? 0),
        located: Number(networkCounts.located ?? 0),
        asnResolved: Number(networkCounts.asnResolved ?? 0),
        publicAddresses: Number(networkCounts.publicAddresses ?? 0),
        total: Number(stat.visits),
        countries,
        regions,
        providers,
        status: network.status(),
      },
      serverTime: new Date().toISOString(),
    });
  });
  app.get('/api/admin/sessions/:id', async (req, res) => {
    if (options.refreshProviderRanges) await providerRanges.refresh();
    const visit = await store.get(String(req.params.id));
    if (!visit) {
      res.status(404).json({ error: 'Visit not found.' });
      return;
    }
    res.json({ visit, events: await store.events(visit.id) });
  });
  app.post('/api/admin/sessions/:id/revoke', async (req, res) => {
    const visit = await store.get(String(req.params.id));
    if (!visit) {
      res.status(404).json({ error: 'Visit not found.' });
      return;
    }
    await store.revoke(visit.id);
    res.json({ ok: true });
  });
  app.get('/api/admin/export', async (req, res) => {
    if (options.refreshProviderRanges) await providerRanges.refresh();
    const sessions = req.query.session
      ? [await store.get(String(req.query.session))].filter((v): v is Visit => !!v)
      : await store.list('1970');
    if (req.query.format === 'csv') {
      const cell = (v: unknown) => {
        let s = String(v ?? '');
        if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
        return `"${s.replaceAll('"', '""')}"`;
      };
      const rows = [
        [
          'Visit ID',
          'Started',
          'Declared or header name',
          'Classification',
          'Status',
          'Objective',
          'Source',
          'Page views',
          'Events',
          'Controlled demo',
          'Arrival IP',
          'Latest IP',
          'IP source',
          'Country',
          'Region',
          'City',
          'ASN',
          'Network operator',
          'Hosting signal (inferred)',
          'IP data source',
          'Provider',
          'Request client',
          'Identity confidence',
          'Crawler role',
          'Referral source',
          'Supplied search query',
          'Last observed path',
          'Range source',
          'Ranges checked at',
        ],
        ...sessions.map((v) => [
          v.id,
          v.createdAt,
          v.agentName,
          v.classification,
          v.status,
          v.objective,
          v.source,
          v.pageCount,
          v.eventCount,
          v.isDemo,
          v.ip,
          v.network?.ip,
          v.network?.ipSource,
          v.network?.location?.country,
          v.network?.location?.region,
          v.network?.location?.city,
          v.network?.asn?.number,
          v.network?.asn?.organization,
          v.network?.hosting?.provider,
          v.network?.enrichment.source
            ? `${v.network.enrichment.source} https://db-ip.com | CC BY 4.0`
            : '',
          v.attribution?.provider,
          v.attribution?.client,
          v.attribution?.confidence,
          v.attribution?.role,
          v.attribution?.referral.source,
          v.attribution?.referral.searchQuery,
          v.journey?.lastPath,
          v.attribution?.rangeCheck?.source,
          v.attribution?.rangeCheck?.checkedAt,
        ]),
      ];
      res
        .type('text/csv')
        .attachment('arrival-visits.csv')
        .send(rows.map((r) => r.map(cell).join(',')).join('\r\n'));
      return;
    }
    res.attachment('arrival-visits.json').json({
      exportedAt: new Date().toISOString(),
      note: 'Latest 300 visits. Provider-range corroboration compares arrival IPs and client headers with current published lists; it is not cryptographic identity or historical ownership proof. Tasks are self-reported. Journeys contain recorded activity only.',
      site: await store.site(),
      networkAttribution: network.status().provider,
      visits: await Promise.all(
        sessions.map(async (visit) => ({ ...visit, events: await store.events(visit.id) })),
      ),
    });
  });
  async function current(req: Request, res: Response): Promise<Visit | undefined> {
    const visit = await store.byToken(sessionToken(req));
    if (!visit || visit.status === 'revoked' || visit.status === 'expired') {
      res.status(401).json({ error: 'This session is unavailable or expired. Start a new visit.' });
      return;
    }
    return visit;
  }
  app.post('/api/agent/check-in', rateLimit('checkin', 90), async (req, res) => {
    const body = validate(
      z
        .object({
          sessionToken: text(120).min(20),
          answers: z
            .record(z.string().max(61), z.union([text(2000), z.array(text(160)).max(12)]))
            .refine((v) => Object.keys(v).length <= 20),
        })
        .strict(),
      req.body,
      res,
    );
    if (!body) return;
    const visit = await store.byToken(body.sessionToken);
    if (
      !visit ||
      !['gateway', 'agent'].includes(visit.source) ||
      !['awaiting', 'observed'].includes(visit.status) ||
      Object.keys(visit.answers).length
    ) {
      res.status(409).json({
        error: 'This check-in is no longer active. Reload the original page to start again.',
      });
      return;
    }
    if (!ownOrigin(req)) {
      res.status(403).json({ error: 'Check in from the original website or your HTTP client.' });
      return;
    }
    const fields = answerErrors(visit.questions, body.answers);
    if (Object.keys(fields).length) {
      await store.event(
        visit.id,
        'check_in_failed',
        '/api/agent/check-in',
        { fields: Object.keys(fields) },
        { method: 'POST', status: 422 },
      );
      res.status(422).json({ error: 'Check the highlighted answers.', fields });
      return;
    }
    if (
      !(await store.site()).requireAdmission ||
      visit.status === 'observed' ||
      visit.source === 'agent'
    ) {
      await store.declare(visit.id, body.answers, 'agent reported');
      res.json({
        ok: true,
        sessionId: visit.id,
        sessionToken: body.sessionToken,
        enforced: false,
        identityVerified: false,
        continueTo: visit.entryPath,
      });
      return;
    }
    const actions = body.answers.actions;
    const permissions = [
      'read',
      ...(Array.isArray(actions) && actions.includes('Search') ? ['search'] : []),
      ...(Array.isArray(actions) && actions.includes('Download files') ? ['download'] : []),
    ];
    const token = await store.admit(visit.id, body.answers, permissions);
    setVisitCookie(req, res, token);
    res.json({
      sessionId: visit.id,
      sessionToken: token,
      permissions,
      expiresAt: (await store.get(visit.id))!.expiresAt,
      identityVerified: false,
      continueTo: visit.entryPath,
    });
  });
  app.post(
    '/api/agent/environment',
    freshRequest,
    rateLimit('telemetry', 600),
    async (req, res) => {
      const visit = await current(req, res);
      if (!visit) return;
      const env = validate(environmentSchema, req.body, res);
      if (!env) return;
      await store.environment(visit.id, env);
      await store.event(
        visit.id,
        'browser_context',
        cleanPath(visit.entryPath),
        { fields: Object.keys(env) },
        { method: 'POST', source: 'browser reported' },
      );
      res.json({ ok: true });
    },
  );
  app.post('/api/agent/events', freshRequest, rateLimit('telemetry', 600), async (req, res) => {
    const visit = await current(req, res);
    if (!visit) return;
    const body = validate(eventSchema, req.body, res);
    if (!body) return;
    await store.event(
      visit.id,
      body.type,
      cleanPath(body.path),
      { label: body.label, depth: body.depth, state: body.state },
      { method: 'POST', source: 'browser reported', dedupeKey: `${visit.id}:${body.id}` },
    );
    res.json({ ok: true });
  });
  async function manifest(req: Request) {
    const site = await store.site(),
      base = store.collectorOrigin ?? `${req.protocol}://${req.get('host')}`;
    return {
      version: '1.0',
      name: 'Arrival agent introductions',
      siteId: site.id,
      website: site.origin,
      optional: site.entryMode !== 'ask',
      blocksAccess: site.entryMode === 'ask',
      entry: {
        mode: site.entryMode ?? 'observe',
        fetchOnly: 'observe',
        intent: 'unknown unless declared',
        atWebsite: `${site.origin}/__arrival`,
        policy: `${base}/api/entry/policy/${site.id}`,
      },
      instructions:
        site.entryMode === 'ask'
          ? 'At the connected website, recognized interactive agents receive a short introduction at their original destination. Answer the website questions once, then follow the continuation URL. Forms and a URL-based submission path are provided there. Never submit private prompts or credentials. Ordinary HTTP fetches, known fetch-only clients, search indexers and unrecognized clients are observed without a required introduction; outages fail open. Request evidence does not reveal their intent.'
          : 'Continue your task normally. If your tools allow it, optionally share a short task summary. Never send private prompts, credentials or personal information. Skipping or a telemetry failure does not restrict website access.',
      questions: site.questions,
      questionsVersion: site.questionsVersion,
      collectionEndpoint: `${base}/api/agent/collect/${site.id}`,
      browserCheckIn: `${base}/check-in/${site.id}`,
      protocol: [
        'POST collectionEndpoint with JSON {type:"start", path:"/page-you-are-visiting"}.',
        'Use the returned sessionToken as Authorization: Bearer <token> for subsequent reports. Reuse that token on start to continue a visit.',
        'POST {type:"check_in", path:"/current-page", answers:{question_id:answer}} to the same endpoint. Use the questions returned by start. Multiple-choice answers are arrays.',
        'Optionally POST {type:"event", path:"/current-page", event:{id:"UUID", type:"page_view", path:"/current-page"}}. Reports are declarations, not independently observed requests.',
      ],
      example: { type: 'start', path: '/' },
      identityVerified: false,
    };
  }
  app.get(['/.well-known/arrival.json', '/api/agent/manifest/:siteId'], async (req, res) => {
    if (req.params.siteId && req.params.siteId !== (await store.site()).id) {
      res.status(404).json({ error: 'Site not found.' });
      return;
    }
    res
      .set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' })
      .json(await manifest(req));
  });
  app.get('/check-in/:siteId', async (req, res) => {
    if (req.params.siteId !== (await store.site()).id) {
      res.sendStatus(404);
      return;
    }
    res
      .set('Cache-Control', 'no-store')
      .type('html')
      .send(checkInPage(await store.site()));
  });
  app.use(['/lab', '/api/lab'], rateLimit('gateway', 600), async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    let token = sessionToken(req),
      visit = await store.byToken(token);
    if (
      !visit ||
      visit.source !== 'gateway' ||
      visit.status === 'expired' ||
      visit.status === 'revoked' ||
      ((await store.site()).requireAdmission && visit.status === 'observed')
    ) {
      const userAgent = (req.get('user-agent') ?? '').slice(0, 1000),
        ip = addressInfo(req.ip ?? '').ip;
      const created = await store.createSession({
        source: 'gateway',
        userAgent,
        ip,
        referrer: cleanReferrer(req.get('referer') ?? ''),
        entryPath: cleanPath(req.originalUrl),
        ...identify(userAgent, ip),
        isDemo: userAgent.startsWith('Arrival-DemoAgent/'),
      });
      token = created.token;
      visit = created.visit;
      setVisitCookie(req, res, token);
      await store.event(
        visit.id,
        'arrival',
        cleanPath(req.originalUrl),
        { classification: visit.classification, verification: 'unverified' },
        { method: req.method },
      );
    }
    await store.network(visit.id, captureNetwork(req, network.lookup));
    res.locals.visit = visit;
    res.locals.arrival = {
      token,
      questions: visit.questions,
      optional: !(await store.site()).requireAdmission,
      answered: Object.keys(visit.answers).length > 0,
    };
    res.set(
      'Link',
      `</api/agent/manifest/${(await store.site()).id}>; rel="alternate"; type="application/json"; title="Optional agent check-in"`,
    );
    if ((await store.site()).requireAdmission && visit.status !== 'admitted') {
      await store.event(
        visit.id,
        'gate_presented',
        cleanPath(req.originalUrl),
        {},
        { method: req.method, status: 403 },
      );
      const challenge = {
        error: 'Check-in required.',
        sessionId: visit.id,
        sessionToken: token,
        questionsVersion: visit.questionsVersion,
        questions: visit.questions,
        checkInEndpoint: '/api/agent/check-in',
        instructions:
          'POST { sessionToken, answers: { question_id: answer } }. Use the returned sessionToken as Authorization: Bearer <token> for protected requests. Do not include private prompts or credentials.',
      };
      if ((req.get('accept') ?? '').includes('text/html') && req.method === 'GET')
        res.status(200).type('html').send(gatePage(visit, token));
      else res.status(403).json(challenge);
      return;
    }
    const permission = req.originalUrl.includes('/search')
      ? 'search'
      : req.originalUrl.includes('/download/')
        ? 'download'
        : 'read';
    if (
      (await store.site()).requireAdmission &&
      visit.status === 'admitted' &&
      !visit.permissions.includes(permission)
    ) {
      await store.event(
        visit.id,
        'access_denied',
        cleanPath(req.originalUrl),
        { permission },
        { status: 403, method: req.method },
      );
      res.status(403).json({ error: `This visit was not granted ${permission} permission.` });
      return;
    }
    next();
  });
  app.get('/lab/download/specification.json', async (req, res) => {
    const visit: Visit = res.locals.visit;
    await store.event(
      visit.id,
      'download',
      req.path,
      { file: 'specification.json' },
      { status: 200 },
    );
    res.attachment('northstar-specification.json').json({
      product: 'Northstar demonstration',
      version: '1.0',
      endpoints: catalog.map((c) => c.path),
      sampleContent: true,
    });
  });
  app.get('/api/lab/search', async (req, res) => {
    const query = String(req.query.q ?? '').slice(0, 120),
      visit: Visit = res.locals.visit;
    const results = catalog.filter((c) =>
      `${c.title} ${c.text}`.toLowerCase().includes(query.toLowerCase()),
    );
    await store.event(
      visit.id,
      'search',
      '/api/lab/search',
      { query, resultCount: results.length },
      { status: 200 },
    );
    res.json({ results });
  });
  app.post('/api/lab/shortlist', freshRequest, async (req, res) => {
    const visit: Visit = res.locals.visit;
    const body = validate(z.object({ plan: z.literal('Team') }).strict(), req.body, res);
    if (!body) return;
    await store.event(visit.id, 'shortlist_saved', '/api/lab/shortlist', body, {
      method: 'POST',
      status: 200,
    });
    res.json({ ok: true });
  });
  app.get(/^\/lab(?:\/.*)?$/, async (req, res) => {
    const visit: Visit = res.locals.visit;
    const path = req.path.replace(/\/$/, '') || '/lab';
    if (!['/lab', ...catalog.map((c) => c.path)].includes(path)) {
      await store.event(visit.id, 'not_found', path, {}, { status: 404 });
      res.status(404).send('Page not found.');
      return;
    }
    await store.event(visit.id, 'page_view', path, {}, { status: 200 });
    const html = labPage(path, visit, res.locals.arrival);
    if ((req.get('accept') ?? '').includes('application/json')) {
      res.json({
        page: { path, html },
        optional: true,
        sessionToken: res.locals.arrival.token,
        questions: visit.questions,
        checkInEndpoint: '/api/agent/check-in',
        instructions:
          'Content is available without answering. Optional: POST {sessionToken, answers} to checkInEndpoint; reuse the returned token for this visit.',
      });
    } else res.type('html').send(html);
  });
  const collectorPaths = ['/api/collect/:siteId', '/api/agent/collect/:siteId'];
  async function collectorOrigin(req: Request) {
    const origin = req.get('origin');
    return (
      origin === (await store.site()).origin ||
      origin === `${req.protocol}://${req.get('host')}` ||
      (!origin && req.path.startsWith('/api/agent/collect/'))
    );
  }
  app.options(collectorPaths, async (req, res) => {
    if (String(req.params.siteId) !== (await store.site()).id || !(await collectorOrigin(req))) {
      res.sendStatus(403);
      return;
    }
    res
      .set({
        'Access-Control-Allow-Origin': req.get('origin') ?? (await store.site()).origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
      })
      .sendStatus(204);
  });
  app.post(collectorPaths, rateLimit('collect', 600), async (req, res) => {
    const site = await store.site();
    if (String(req.params.siteId) !== site.id || !(await collectorOrigin(req))) {
      res.status(403).json({ error: 'Configure this website’s exact origin in Arrival first.' });
      return;
    }
    res.set({ 'Access-Control-Allow-Origin': req.get('origin') ?? site.origin, Vary: 'Origin' });
    const channel = req.path.startsWith('/api/agent/collect/') ? 'agent' : 'browser';
    const provenance = channel === 'agent' ? 'agent reported' : 'browser reported';
    const body = validate(
      z
        .object({
          type: z.enum(['start', 'event', 'check_in']),
          path: text(700),
          referrer: text(700).optional(),
          environment: environmentSchema.optional(),
          event: eventSchema.optional(),
          answers: z
            .record(z.string().max(61), z.union([text(2000), z.array(text(160)).max(12)]))
            .refine((v) => Object.keys(v).length <= 20)
            .optional(),
        })
        .strict(),
      req.body,
      res,
    );
    if (!body) return;
    const linkedVisit = channel === 'browser' ? await store.byVisitorToken(bearer(req)) : undefined;
    let visit = linkedVisit ?? (await store.byToken(bearer(req)));
    if (body.type === 'start') {
      let token: string | undefined;
      if (
        !visit ||
        (!['browser', 'agent'].includes(visit.source) && !linkedVisit) ||
        visit.status === 'expired' ||
        visit.status === 'revoked'
      ) {
        const ua = (req.get('user-agent') ?? '').slice(0, 1000),
          ip = addressInfo(req.ip ?? '').ip;
        const created = await store.createSession({
          source: channel,
          isDemo: ua.startsWith('Arrival-DemoAgent/'),
          userAgent: ua,
          ip,
          referrer: cleanReferrer(body.referrer ?? ''),
          entryPath: cleanPath(body.path),
          ...identify(ua, ip),
        });
        visit = created.visit;
        token = created.token;
      }
      await store.network(visit.id, captureNetwork(req, network.lookup));
      if (body.environment) await store.environment(visit.id, body.environment, provenance);
      await store.event(
        visit.id,
        'page_view',
        cleanPath(body.path),
        { origin: req.get('origin') ?? '' },
        { source: provenance },
      );
      res.json({
        sessionId: visit.id,
        questions: visit.questions,
        answered: Object.keys(visit.answers).length > 0,
        optional: true,
        blocksAccess: false,
        ...(token ? { sessionToken: token } : {}),
      });
      return;
    }
    if (
      !visit ||
      (!['browser', 'agent'].includes(visit.source) && !linkedVisit) ||
      visit.status === 'revoked' ||
      visit.status === 'expired'
    ) {
      res.status(401).json({ error: 'Start a valid browser collection session first.' });
      return;
    }
    if (body.type === 'check_in') {
      if (!body.answers) {
        res.status(422).json({ error: 'Answers are required.' });
        return;
      }
      if (Object.keys(visit.answers).length) {
        res.status(409).json({ error: 'This visit has already declared a purpose.' });
        return;
      }
      const fields = answerErrors(visit.questions, body.answers);
      if (Object.keys(fields).length) {
        res.status(422).json({ error: 'Please complete the required questions.', fields });
        return;
      }
      await store.declare(visit.id, body.answers, provenance);
      res.json({ ok: true, enforced: false });
      return;
    }
    if (!body.event) {
      res.status(422).json({ error: 'An event is required.' });
      return;
    }
    const event = body.event;
    await store.event(
      visit.id,
      event.type,
      cleanPath(event.path),
      { label: event.label, depth: event.depth, state: event.state },
      { method: 'POST', source: provenance, dedupeKey: `${visit.id}:${event.id}` },
    );
    res.json({ ok: true });
  });
  app.post('/api/ingest', rateLimit('ingest', 600), async (req, res) => {
    if (!(await store.keyValid(bearer(req)))) {
      res.status(401).json({ error: 'A valid server ingestion key is required.' });
      return;
    }
    const body = validate(
      z
        .object({
          eventId: z.uuid(),
          sessionId: text(120).min(1),
          method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
          path: text(700),
          status: z.number().int().min(100).max(599).optional(),
          userAgent: text(1000),
          ip: text(100).optional(),
          referrer: text(700).optional(),
          durationMs: z.number().min(0).max(3600000).optional(),
          entryContinued: z.boolean().optional(),
          entryDisposition: z.literal('fetch_only').optional(),
          headers: z
            .record(z.string().max(80), text(700))
            .refine((v) => Object.keys(v).length <= 30)
            .optional(),
          httpVersion: text(12).optional(),
          scheme: z.enum(['http', 'https']).optional(),
        })
        .strict(),
      req.body,
      res,
    );
    if (!body) return;
    const existing = await store
      .scoped('SELECT session_id FROM events WHERE dedupe_key=?')
      .get(`${store.siteId}:ingest:${body.eventId}`);
    if (existing) {
      res.json({ sessionId: existing.session_id, inserted: false });
      return;
    }
    let visit = await store.byExternal(`server:${body.sessionId}`);
    if (!visit)
      visit = (
        await store.createSession({
          source: 'server',
          externalKey: `server:${body.sessionId}`,
          userAgent: body.userAgent,
          ip: addressInfo(body.ip ?? '').ip,
          referrer: cleanReferrer(body.referrer ?? ''),
          entryPath: cleanPath(body.path),
          ...identify(body.userAgent, addressInfo(body.ip ?? '').ip, 'integration reported'),
        })
      ).visit;
    await store.network(
      visit.id,
      reportedNetwork(body.ip ?? '', network.lookup, {
        method: body.method,
        httpVersion: body.httpVersion,
        scheme: body.scheme,
        headers: body.headers,
      }),
    );
    const inserted = await store.event(
      visit.id,
      'request',
      cleanPath(body.path),
      { durationMs: body.durationMs },
      {
        method: body.method,
        status: body.status,
        source: 'integration reported',
        dedupeKey: `${store.siteId}:ingest:${body.eventId}`,
      },
    );
    if (body.entryDisposition === 'fetch_only')
      await store.event(
        visit.id,
        'entry_observed',
        cleanPath(body.path),
        { reason: 'fetch_only', policySource: 'request headers; unverified' },
        { source: 'integration reported', dedupeKey: `entry-observed:${visit.id}` },
      );
    if (body.entryContinued)
      await store.event(
        visit.id,
        'entry_continued',
        cleanPath(body.path),
        {},
        { source: 'integration reported', dedupeKey: `entry-continued:${visit.id}` },
      );
    res.json({ sessionId: visit.id, inserted });
  });
  app.post('/api/admin/run-demo', rateLimit('demo', 10), async (req, res) => {
    const base = options.databaseConnection
        ? store.collectorOrigin!
        : `http://127.0.0.1:${req.socket.localPort}`,
      headers = { 'User-Agent': 'Arrival-DemoAgent/1.0', Accept: 'application/json' };
    const first = await fetch(`${base}/lab`, { headers, signal: AbortSignal.timeout(10000) });
    const challenge = await first.json();
    if (!challenge.questions) {
      res
        .status(409)
        .json({ error: 'Enable admission in Questions before running the check-in demo.' });
      return;
    }
    const answers: Visit['answers'] = {};
    for (const q of challenge.questions as Question[])
      answers[q.id] =
        q.id === 'agent_name'
          ? 'Arrival demo agent'
          : q.id === 'objective'
            ? 'Compare Northstar’s Team plan and API capabilities for a small engineering team.'
            : q.id === 'discovery'
              ? 'Owner-initiated local HTTP demonstration'
              : q.id === 'success'
                ? 'Read the pricing and documentation, search integrations, and download the API specification.'
                : q.type === 'multiselect'
                  ? q.options
                  : q.type === 'select'
                    ? q.options[0]
                    : 'Controlled demonstration answer';
    const admitted = await fetch(`${base}/api/agent/check-in`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: challenge.sessionToken, answers }),
      signal: AbortSignal.timeout(10000),
    });
    if (!admitted.ok) {
      res.status(502).json({ error: 'The demo agent could not complete check-in.' });
      return;
    }
    const grant = await admitted.json(),
      auth = { ...headers, Authorization: `Bearer ${grant.sessionToken}` };
    for (const path of [
      '/lab',
      '/lab/pricing',
      '/lab/docs',
      '/lab/integrations',
      '/api/lab/search?q=Python',
      '/lab/download/specification.json',
    ]) {
      const response = await fetch(`${base}${path}`, {
        headers: auth,
        signal: AbortSignal.timeout(10000),
      });
      await response.arrayBuffer();
    }
    res.json({ sessionId: grant.sessionId });
  });
  app.use('/sdk', express.static(resolve('sdk'), { maxAge: 0, index: false }));
  app.use(express.static(resolve('public'), { maxAge: 0 }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const status = (
      error as {
        status?: number;
      }
    )?.status;
    console.error(error instanceof Error ? error.message : 'Request failed');
    res.status(status === 413 ? 413 : status === 400 ? 400 : 500).json({
      error:
        status === 413
          ? 'The request is too large.'
          : status === 400
            ? 'Invalid JSON request.'
            : 'The request could not be completed.',
    });
  });
  return { app, store };
}
