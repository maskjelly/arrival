import express, { type Request, type Response, type NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { Store, credential, hash } from './store.ts';
import { cleanPath, cleanReferrer, identify } from './signals.ts';
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

export function createApp(
  options: {
    databasePath?: string;
    adminPassword?: string;
    trustedProxy?: string;
    publicOrigin?: string;
    networkService?: NetworkEnricher;
  } = {},
) {
  const store = new Store(options.databasePath ?? resolve('.data/arrival.sqlite'));
  const network = options.networkService ?? new NetworkEnricher();
  const refreshNetworkArchive = () => {
    let updated = 0;
    for (const visit of store.list('1970')) {
      const context = visit.network;
      store.network(
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
  if (network.status().enabled) refreshNetworkArchive();
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
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const limits = new Map<string, { count: number; reset: number }>();
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
  function owner(req: Request, res: Response, next: NextFunction) {
    const token = cookies(req).arrival_owner;
    if (
      !token ||
      !store.db
        .prepare('SELECT 1 FROM admin_sessions WHERE token_hash=? AND expires_at>?')
        .get(hash(token), new Date().toISOString())
    ) {
      res.status(401).json({ error: 'Sign in to access the dashboard.' });
      return;
    }
    next();
  }
  function ownerSession(req: Request, res: Response) {
    const token = credential();
    store.db.prepare('DELETE FROM admin_sessions WHERE expires_at<?').run(new Date().toISOString());
    store.db
      .prepare('INSERT INTO admin_sessions VALUES (?,?)')
      .run(hash(token), new Date(Date.now() + 28800000).toISOString());
    res.cookie('arrival_owner', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure,
      maxAge: 28800000,
      path: '/',
    });
  }
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'arrival' }));
  app.post('/api/auth/local', freshRequest, rateLimit('auth', 15), (req, res) => {
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
    ownerSession(req, res);
    res.json({ ok: true, mode: 'local-only' });
  });
  app.post('/api/auth/login', freshRequest, rateLimit('auth', 15), (req, res) => {
    const body = validate(z.object({ password: text(256) }).strict(), req.body, res);
    if (!body) return;
    if (
      !options.adminPassword ||
      !timingSafeEqual(Buffer.from(hash(body.password)), Buffer.from(hash(options.adminPassword)))
    ) {
      res.status(401).json({ error: 'The password did not match.' });
      return;
    }
    ownerSession(req, res);
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', freshRequest, (req, res) => {
    store.db
      .prepare('DELETE FROM admin_sessions WHERE token_hash=?')
      .run(hash(cookies(req).arrival_owner ?? ''));
    res.clearCookie('arrival_owner');
    res.json({ ok: true });
  });
  app.use('/api/admin', freshRequest, owner);
  app.get('/api/admin/site', (_req, res) => res.json(store.site()));
  app.get('/api/admin/network', (_req, res) => res.json(network.status()));
  app.post('/api/admin/network/update', rateLimit('geo-update', 3), (_req, res) => {
    void network
      .update()
      .then(() => {
        if (network.status().enabled) refreshNetworkArchive();
      })
      .catch(() => {});
    res.status(202).json(network.status());
  });
  app.post('/api/admin/network/backfill', (_req, res) =>
    res.json({ updated: refreshNetworkArchive(), status: network.status() }),
  );
  app.get('/api/admin/installation', (_req, res) => {
    const browser = store.db
      .prepare(
        "SELECT MAX(created_at) AS lastSeen, COUNT(DISTINCT session_id) AS visits FROM events WHERE type='page_view' AND source='browser reported' AND json_extract(data,'$.origin')=?",
      )
      .get(store.site().origin);
    const server = store.db
      .prepare(
        "SELECT MAX(updated_at) AS lastSeen, COUNT(*) AS visits FROM sessions WHERE source='server'",
      )
      .get();
    res.json({ browser, server });
  });
  app.put('/api/admin/site', (req, res) => {
    const body = validate(configSchema, req.body, res);
    if (!body) return;
    res.json(store.updateSite({ ...body, origin: new URL(body.origin).origin }));
  });
  app.post('/api/admin/ingest-key', (_req, res) => res.json({ key: store.rotateKey() }));
  app.get('/api/admin/overview', (req, res) => {
    const range = req.query.range === '7d' ? '7d' : req.query.range === 'all' ? 'all' : '24h';
    const since =
      range === 'all'
        ? '1970'
        : new Date(Date.now() - (range === '7d' ? 7 : 1) * 86400000).toISOString();
    const sessions = store.list(since);
    const stat = store.db
      .prepare(
        `SELECT COUNT(*) AS visits, SUM(CASE WHEN status='admitted' AND expires_at>? THEN 1 ELSE 0 END) AS admitted, SUM(CASE WHEN answers!='{}' THEN 1 ELSE 0 END) AS answered, SUM(CASE WHEN classification!='unknown' THEN 1 ELSE 0 END) AS automated, SUM(is_demo) AS demo FROM sessions WHERE created_at>=?`,
      )
      .get(new Date().toISOString(), since)!;
    const totalEvents = store.db
      .prepare('SELECT COUNT(*) AS n FROM events WHERE created_at>=?')
      .get(since)!;
    const chart: { time: string; visits: number; events: number }[] = [];
    const hourly = range === '24h';
    const step = hourly ? 3600000 : 86400000;
    const start = Math.floor((Date.now() - (hourly ? 23 : 6) * step) / step) * step;
    const buckets = store.db
      .prepare(
        `SELECT substr(created_at,1,${hourly ? 13 : 10}) AS bucket, COUNT(*) AS n FROM events WHERE created_at>=? GROUP BY bucket`,
      )
      .all(new Date(start).toISOString());
    const visitBuckets = store.db
      .prepare(
        `SELECT substr(created_at,1,${hourly ? 13 : 10}) AS bucket, COUNT(*) AS n FROM sessions WHERE created_at>=? GROUP BY bucket`,
      )
      .all(new Date(start).toISOString());
    for (let i = 0; i < (hourly ? 24 : 7); i++) {
      const time = new Date(start + i * step).toISOString(),
        key = time.slice(0, hourly ? 13 : 10);
      chart.push({
        time,
        visits: Number(visitBuckets.find((b) => b.bucket === key)?.n ?? 0),
        events: Number(buckets.find((b) => b.bucket === key)?.n ?? 0),
      });
    }
    const pages = store.db
      .prepare(
        "SELECT path, COUNT(*) AS count FROM events WHERE type='page_view' AND created_at>=? GROUP BY path ORDER BY count DESC LIMIT 6",
      )
      .all(since);
    const sources = store.db
      .prepare(
        'SELECT agent_name AS name, COUNT(*) AS count FROM sessions WHERE created_at>=? GROUP BY agent_name ORDER BY count DESC LIMIT 5',
      )
      .all(since);
    const networkCounts = store.db
      .prepare(
        `SELECT COUNT(DISTINCT json_extract(network,'$.location.countryCode')) AS countryCount,
      SUM(CASE WHEN json_extract(network,'$.location.countryCode') IS NOT NULL THEN 1 ELSE 0 END) AS located,
      SUM(CASE WHEN json_extract(network,'$.asn.number') IS NOT NULL THEN 1 ELSE 0 END) AS asnResolved,
      SUM(CASE WHEN json_extract(network,'$.scope')='public' THEN 1 ELSE 0 END) AS publicAddresses
      FROM sessions WHERE created_at>=?`,
      )
      .get(since)!;
    const countries = store.db
      .prepare(
        `SELECT json_extract(network,'$.location.countryCode') AS code,
      json_extract(network,'$.location.country') AS name, COUNT(*) AS count FROM sessions
      WHERE created_at>=? AND json_extract(network,'$.location.countryCode') IS NOT NULL GROUP BY code ORDER BY count DESC LIMIT 6`,
      )
      .all(since);
    const providers = store.db
      .prepare(
        `SELECT json_extract(network,'$.asn.organization') AS name, COUNT(*) AS count FROM sessions
      WHERE created_at>=? AND json_extract(network,'$.asn.organization') IS NOT NULL GROUP BY name ORDER BY count DESC LIMIT 6`,
      )
      .all(since);
    res.json({
      site: store.site(),
      sessions,
      total: Number(stat.visits),
      stats: {
        visits: Number(stat.visits),
        admitted: Number(stat.admitted ?? 0),
        answered: Number(stat.answered ?? 0),
        events: Number(totalEvents.n),
        automated: Number(stat.automated ?? 0),
        demo: Number(stat.demo ?? 0),
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
        providers,
        status: network.status(),
      },
      serverTime: new Date().toISOString(),
    });
  });
  app.get('/api/admin/sessions/:id', (req, res) => {
    const visit = store.get(String(req.params.id));
    if (!visit) {
      res.status(404).json({ error: 'Visit not found.' });
      return;
    }
    res.json({ visit, events: store.events(visit.id) });
  });
  app.post('/api/admin/sessions/:id/revoke', (req, res) => {
    const visit = store.get(String(req.params.id));
    if (!visit) {
      res.status(404).json({ error: 'Visit not found.' });
      return;
    }
    store.revoke(visit.id);
    res.json({ ok: true });
  });
  app.get('/api/admin/export', (req, res) => {
    const sessions = req.query.session
      ? [store.get(String(req.query.session))].filter((v): v is Visit => !!v)
      : store.list('1970');
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
          'Declared or inferred name',
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
      note: 'Latest 300 visits. Client identities and task answers are unverified unless separately documented. No verification service is connected.',
      site: store.site(),
      networkAttribution: network.status().provider,
      visits: sessions.map((visit) => ({ ...visit, events: store.events(visit.id) })),
    });
  });

  function current(req: Request, res: Response): Visit | undefined {
    const visit = store.byToken(sessionToken(req));
    if (!visit || visit.status === 'revoked' || visit.status === 'expired') {
      res.status(401).json({ error: 'This session is unavailable or expired. Start a new visit.' });
      return;
    }
    return visit;
  }
  app.post('/api/agent/check-in', rateLimit('checkin', 90), (req, res) => {
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
    const visit = store.byToken(body.sessionToken);
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
      store.event(
        visit.id,
        'check_in_failed',
        '/api/agent/check-in',
        { fields: Object.keys(fields) },
        { method: 'POST', status: 422 },
      );
      res.status(422).json({ error: 'Check the highlighted answers.', fields });
      return;
    }
    if (!store.site().requireAdmission || visit.status === 'observed' || visit.source === 'agent') {
      store.declare(visit.id, body.answers, 'agent reported');
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
    const token = store.admit(visit.id, body.answers, permissions);
    setVisitCookie(req, res, token);
    res.json({
      sessionId: visit.id,
      sessionToken: token,
      permissions,
      expiresAt: store.get(visit.id)!.expiresAt,
      identityVerified: false,
      continueTo: visit.entryPath,
    });
  });
  app.post('/api/agent/environment', freshRequest, rateLimit('telemetry', 600), (req, res) => {
    const visit = current(req, res);
    if (!visit) return;
    const env = validate(environmentSchema, req.body, res);
    if (!env) return;
    store.environment(visit.id, env);
    store.event(
      visit.id,
      'browser_context',
      cleanPath(visit.entryPath),
      { fields: Object.keys(env) },
      { method: 'POST', source: 'browser reported' },
    );
    res.json({ ok: true });
  });
  app.post('/api/agent/events', freshRequest, rateLimit('telemetry', 600), (req, res) => {
    const visit = current(req, res);
    if (!visit) return;
    const body = validate(eventSchema, req.body, res);
    if (!body) return;
    store.event(
      visit.id,
      body.type,
      cleanPath(body.path),
      { label: body.label, depth: body.depth, state: body.state },
      { method: 'POST', source: 'browser reported', dedupeKey: `${visit.id}:${body.id}` },
    );
    res.json({ ok: true });
  });

  function manifest(req: Request) {
    const site = store.site(),
      base = store.collectorOrigin ?? `${req.protocol}://${req.get('host')}`;
    return {
      version: '1.0',
      name: 'Arrival optional agent observability',
      siteId: site.id,
      website: site.origin,
      optional: true,
      blocksAccess: false,
      instructions:
        'Continue your task normally. If your tools allow it, optionally share a short task summary. Never send private prompts, credentials or personal information. Skipping or a telemetry failure does not restrict website access.',
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
  app.get(['/.well-known/arrival.json', '/api/agent/manifest/:siteId'], (req, res) => {
    if (req.params.siteId && req.params.siteId !== store.site().id) {
      res.status(404).json({ error: 'Site not found.' });
      return;
    }
    res
      .set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' })
      .json(manifest(req));
  });
  app.get('/check-in/:siteId', (req, res) => {
    if (req.params.siteId !== store.site().id) {
      res.sendStatus(404);
      return;
    }
    res.set('Cache-Control', 'no-store').type('html').send(checkInPage(store.site()));
  });

  app.use(['/lab', '/api/lab'], rateLimit('gateway', 600), (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    let token = sessionToken(req),
      visit = store.byToken(token);
    if (
      !visit ||
      visit.source !== 'gateway' ||
      visit.status === 'expired' ||
      visit.status === 'revoked' ||
      (store.site().requireAdmission && visit.status === 'observed')
    ) {
      const userAgent = (req.get('user-agent') ?? '').slice(0, 1000),
        ip = addressInfo(req.ip ?? '').ip;
      const created = store.createSession({
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
      store.event(
        visit.id,
        'arrival',
        cleanPath(req.originalUrl),
        { classification: visit.classification, verification: 'unverified' },
        { method: req.method },
      );
    }
    store.network(visit.id, captureNetwork(req, network.lookup));
    res.locals.visit = visit;
    res.locals.arrival = {
      token,
      questions: visit.questions,
      optional: !store.site().requireAdmission,
      answered: Object.keys(visit.answers).length > 0,
    };
    res.set(
      'Link',
      `</api/agent/manifest/${store.site().id}>; rel="alternate"; type="application/json"; title="Optional agent check-in"`,
    );
    if (store.site().requireAdmission && visit.status !== 'admitted') {
      store.event(
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
      store.site().requireAdmission &&
      visit.status === 'admitted' &&
      !visit.permissions.includes(permission)
    ) {
      store.event(
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
  app.get('/lab/download/specification.json', (req, res) => {
    const visit: Visit = res.locals.visit;
    store.event(visit.id, 'download', req.path, { file: 'specification.json' }, { status: 200 });
    res.attachment('northstar-specification.json').json({
      product: 'Northstar demonstration',
      version: '1.0',
      endpoints: catalog.map((c) => c.path),
      sampleContent: true,
    });
  });
  app.get('/api/lab/search', (req, res) => {
    const query = String(req.query.q ?? '').slice(0, 120),
      visit: Visit = res.locals.visit;
    const results = catalog.filter((c) =>
      `${c.title} ${c.text}`.toLowerCase().includes(query.toLowerCase()),
    );
    store.event(
      visit.id,
      'search',
      '/api/lab/search',
      { query, resultCount: results.length },
      { status: 200 },
    );
    res.json({ results });
  });
  app.post('/api/lab/shortlist', freshRequest, (req, res) => {
    const visit: Visit = res.locals.visit;
    const body = validate(z.object({ plan: z.literal('Team') }).strict(), req.body, res);
    if (!body) return;
    store.event(visit.id, 'shortlist_saved', '/api/lab/shortlist', body, {
      method: 'POST',
      status: 200,
    });
    res.json({ ok: true });
  });
  app.get(/^\/lab(?:\/.*)?$/, (req, res) => {
    const visit: Visit = res.locals.visit;
    const path = req.path.replace(/\/$/, '') || '/lab';
    if (!['/lab', ...catalog.map((c) => c.path)].includes(path)) {
      store.event(visit.id, 'not_found', path, {}, { status: 404 });
      res.status(404).send('Page not found.');
      return;
    }
    store.event(visit.id, 'page_view', path, {}, { status: 200 });
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
  function collectorOrigin(req: Request) {
    const origin = req.get('origin');
    return (
      origin === store.site().origin ||
      origin === `${req.protocol}://${req.get('host')}` ||
      (!origin && req.path.startsWith('/api/agent/collect/'))
    );
  }
  app.options(collectorPaths, (req, res) => {
    if (String(req.params.siteId) !== store.site().id || !collectorOrigin(req)) {
      res.sendStatus(403);
      return;
    }
    res
      .set({
        'Access-Control-Allow-Origin': req.get('origin') ?? store.site().origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
      })
      .sendStatus(204);
  });
  app.post(collectorPaths, rateLimit('collect', 600), (req, res) => {
    const site = store.site();
    if (String(req.params.siteId) !== site.id || !collectorOrigin(req)) {
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
    let visit = store.byToken(bearer(req));
    if (body.type === 'start') {
      let token: string | undefined;
      if (
        !visit ||
        !['browser', 'agent'].includes(visit.source) ||
        visit.status === 'expired' ||
        visit.status === 'revoked'
      ) {
        const ua = (req.get('user-agent') ?? '').slice(0, 1000),
          ip = addressInfo(req.ip ?? '').ip;
        const created = store.createSession({
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
      store.network(visit.id, captureNetwork(req, network.lookup));
      if (body.environment) store.environment(visit.id, body.environment, provenance);
      store.event(
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
      !['browser', 'agent'].includes(visit.source) ||
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
      store.declare(visit.id, body.answers, provenance);
      res.json({ ok: true, enforced: false });
      return;
    }
    if (!body.event) {
      res.status(422).json({ error: 'An event is required.' });
      return;
    }
    const event = body.event;
    store.event(
      visit.id,
      event.type,
      cleanPath(event.path),
      { label: event.label, depth: event.depth, state: event.state },
      { method: 'POST', source: provenance, dedupeKey: `${visit.id}:${event.id}` },
    );
    res.json({ ok: true });
  });
  app.post('/api/ingest', rateLimit('ingest', 600), (req, res) => {
    if (!store.keyValid(bearer(req))) {
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
    const existing = store.db
      .prepare('SELECT session_id FROM events WHERE dedupe_key=?')
      .get(`ingest:${body.eventId}`);
    if (existing) {
      res.json({ sessionId: existing.session_id, inserted: false });
      return;
    }
    let visit = store.byExternal(`server:${body.sessionId}`);
    if (!visit)
      visit = store.createSession({
        source: 'server',
        externalKey: `server:${body.sessionId}`,
        userAgent: body.userAgent,
        ip: addressInfo(body.ip ?? '').ip,
        referrer: cleanReferrer(body.referrer ?? ''),
        entryPath: cleanPath(body.path),
        ...identify(body.userAgent, addressInfo(body.ip ?? '').ip, 'integration reported'),
      }).visit;
    store.network(
      visit.id,
      reportedNetwork(body.ip ?? '', network.lookup, {
        method: body.method,
        httpVersion: body.httpVersion,
        scheme: body.scheme,
        headers: body.headers,
      }),
    );
    const inserted = store.event(
      visit.id,
      'request',
      cleanPath(body.path),
      { durationMs: body.durationMs },
      {
        method: body.method,
        status: body.status,
        source: 'integration reported',
        dedupeKey: `ingest:${body.eventId}`,
      },
    );
    res.json({ sessionId: visit.id, inserted });
  });
  app.post('/api/admin/run-demo', rateLimit('demo', 10), async (req, res) => {
    const base = `http://127.0.0.1:${req.socket.localPort}`,
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
    const status = (error as { status?: number })?.status;
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
