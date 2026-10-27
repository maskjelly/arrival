import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.ts';
import { Store } from '../server/store.ts';
import express from 'express';
import { arrivalAnalytics } from '../sdk/arrival.ts';
import { reportArrival } from '../sdk/web.ts';

async function fixture(password?: string, requireAdmission = true) {
  const { app, store } = createApp({ databasePath: ':memory:', adminPassword: password });
  if (requireAdmission) {
    const site = store.site();
    store.updateSite({ ...site, requireAdmission: true });
  }
  const server = createServer(app);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = (path: string, options: RequestInit = {}) => fetch(base + path, options);
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const bootstrap = async () => {
    const response = await post('/api/auth/local', {});
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie')!.split(';')[0];
  };
  const challenge = async () => {
    const response = await request('/lab', {
      headers: { Accept: 'application/json', 'User-Agent': 'TestAgent/1.0' },
    });
    assert.equal(response.status, 403);
    return response.json();
  };
  const answers = {
    agent_name: 'Test research agent',
    objective: 'Compare pricing and API features',
    task_type: 'Research',
    actions: ['Read pages', 'Search', 'Download files'],
  };
  const admit = async (input = answers) => {
    const c = await challenge();
    const response = await post('/api/agent/check-in', {
      sessionToken: c.sessionToken,
      answers: input,
    });
    assert.equal(response.status, 200, await response.clone().text());
    return { challenge: c, grant: await response.json() };
  };
  const close = async () => {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    store.close();
  };
  return { store, request, post, bootstrap, challenge, admit, answers, close, base };
}

test('default observation never withholds content, even without answers or after a bad check-in', async () => {
  const f = await fixture(undefined, false);
  try {
    assert.equal(f.store.site().requireAdmission, false);
    const page = await f.request('/lab/pricing', { headers: { Accept: 'text/html' } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /\$49/);
    assert.match(page.headers.get('link')!, /manifest/);
    const json = await f.request('/lab', { headers: { Accept: 'application/json' } });
    const context = await json.json();
    assert.equal(json.status, 200);
    assert.equal(context.optional, true);
    assert.equal(
      (await f.post('/api/agent/check-in', { sessionToken: context.sessionToken, answers: {} }))
        .status,
      422,
    );
    const headers = { Authorization: `Bearer ${context.sessionToken}` };
    assert.equal((await f.request('/api/lab/search?q=Python', { headers })).status, 200);
    const shared = await f.post('/api/agent/check-in', {
      sessionToken: context.sessionToken,
      answers: f.answers,
    });
    assert.equal(shared.status, 200);
    assert.equal((await shared.json()).enforced, false);
    const visit = f.store.byToken(context.sessionToken)!;
    assert.equal(visit.status, 'observed');
    assert.deepEqual(visit.permissions, []);
    assert.equal(visit.objective, f.answers.objective);
    const cookie = await f.bootstrap();
    assert.equal(
      (await f.post(`/api/admin/sessions/${visit.id}/revoke`, {}, { Cookie: cookie })).status,
      200,
    );
    // Revoking an analytics record does not turn observation into access control.
    assert.equal((await f.request('/lab/docs', { headers })).status, 200);
  } finally {
    await f.close();
  }
});

test('HTTP agents discover optional questions, resume a session and submit unverified declarations', async () => {
  const f = await fixture(undefined, false);
  try {
    const manifest = await (await f.request('/.well-known/arrival.json')).json();
    assert.equal(manifest.blocksAccess, false);
    assert.equal(manifest.optional, true);
    assert.ok(!JSON.stringify(manifest).includes('ingest_hash'));
    assert.equal((await f.request('/check-in/site_local')).status, 200);
    const path = new URL(manifest.collectionEndpoint).pathname;
    const start = await f.post(path, { type: 'start', path: '/docs?private=removed' });
    assert.equal(start.status, 200);
    const session = await start.json();
    const headers = { Authorization: `Bearer ${session.sessionToken}` };
    const resume = await f.post(path, { type: 'start', path: '/pricing' }, headers);
    assert.equal((await resume.json()).sessionId, session.sessionId);
    assert.equal(
      (await f.post(path, { type: 'check_in', path: '/pricing', answers: f.answers }, headers))
        .status,
      200,
    );
    const visit = f.store.get(session.sessionId)!;
    assert.equal(visit.source, 'agent');
    assert.equal(visit.status, 'observed');
    assert.equal(visit.entryPath, '/docs');
    assert.equal(visit.pageCount, 2);
    assert.ok(f.store.events(visit.id).every((e) => e.source === 'agent reported'));
    assert.equal(
      (await f.post(path, { type: 'start', path: '/' }, { Origin: 'https://wrong.example' }))
        .status,
      403,
    );
    assert.equal(
      (await f.post('/api/collect/site_local', { type: 'start', path: '/' })).status,
      403,
    );
    const cookie = await f.bootstrap();
    const installation = await f.request('/api/admin/installation', {
      headers: { Cookie: cookie },
    });
    assert.equal((await installation.json()).browser.lastSeen, null);
  } finally {
    await f.close();
  }
});

test('Web Request adapter sends request evidence without inventing response status and swallows error hooks', async () => {
  const f = await fixture(undefined, false);
  try {
    const key = f.store.rotateKey();
    const request = new Request('https://host.example/docs?private=removed', {
      headers: { 'User-Agent': 'GPTBot/1.0' },
    });
    assert.equal(
      await reportArrival(request, { endpoint: f.base, key, sessionId: 'nextjs-session' }),
      true,
    );
    const visit = f.store.list('1970')[0];
    assert.equal(visit.entryPath, '/docs');
    assert.equal(f.store.events(visit.id)[0].status, null);
    assert.equal(
      await reportArrival(request, {
        endpoint: f.base,
        key: 'wrong',
        sessionId: 'bad-key',
        onError: () => {
          throw new Error('bad logging hook');
        },
      }),
      false,
    );
    assert.equal(
      await reportArrival(request, { endpoint: f.base, key: undefined, sessionId: 'no-key' }),
      false,
    );
  } finally {
    await f.close();
  }
});

test('disabling advanced admission removes restrictions from existing grants and pending visits', async () => {
  const f = await fixture();
  try {
    const { grant } = await f.admit({ ...f.answers, actions: ['Read pages'] });
    const pending = await f.challenge();
    f.store.updateSite({ ...f.store.site(), requireAdmission: false });
    const headers = { Authorization: `Bearer ${grant.sessionToken}` };
    assert.equal((await f.request('/api/lab/search?q=Python', { headers })).status, 200);
    const shared = await f.post('/api/agent/check-in', {
      sessionToken: pending.sessionToken,
      answers: f.answers,
    });
    assert.equal((await shared.json()).enforced, false);
    assert.equal(f.store.byToken(pending.sessionToken)!.status, 'observed');
    assert.equal(
      (
        await f.request('/lab/pricing', {
          headers: { Authorization: `Bearer ${pending.sessionToken}` },
        })
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test('missing or invalid Express collector configuration cannot prevent the host serving content', async () => {
  const app = express();
  app.use(
    arrivalAnalytics({
      endpoint: 'not a URL',
      key: undefined,
      onError: () => {
        throw new Error('Logging failed');
      },
    }),
  );
  app.get('/', (_req, res) => res.send('Still available'));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as { port: number }).port}/`,
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'Still available');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('owner routes require authentication; local bootstrap rejects cross-site requests', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request('/api/admin/overview')).status, 401);
    assert.equal(
      (await f.post('/api/auth/local', {}, { Origin: 'https://attacker.example' })).status,
      403,
    );
    const rebound = await new Promise<number | undefined>((done, reject) => {
      const request = httpRequest(
        f.base + '/api/auth/local',
        {
          method: 'POST',
          headers: { Host: 'attacker.example', 'Content-Type': 'application/json' },
        },
        (response) => {
          response.resume();
          done(response.statusCode);
        },
      );
      request.on('error', reject);
      request.end('{}');
    });
    assert.equal(rebound, 401);
    const cookie = await f.bootstrap();
    assert.equal(
      (await f.request('/api/admin/overview', { headers: { Cookie: cookie } })).status,
      200,
    );
    assert.equal(
      (
        await f.post(
          '/api/admin/ingest-key',
          {},
          { Cookie: cookie, Origin: 'https://attacker.example' },
        )
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});

test('password mode disables local bootstrap and authenticates the configured owner', async () => {
  const f = await fixture('a-long-owner-password');
  try {
    assert.equal((await f.post('/api/auth/local', {})).status, 401);
    assert.equal((await f.post('/api/auth/login', { password: 'wrong' })).status, 401);
    const login = await f.post('/api/auth/login', { password: 'a-long-owner-password' });
    assert.equal(login.status, 200);
    assert.equal(
      (
        await f.request('/api/admin/site', {
          headers: { Cookie: login.headers.get('set-cookie')!.split(';')[0] },
        })
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test('gate withholds HTML and API content until required answers are valid', async () => {
  const f = await fixture();
  try {
    const c = await f.challenge();
    assert.equal(
      (await f.post('/api/agent/check-in', { sessionToken: c.sessionToken, answers: {} })).status,
      422,
    );
    assert.equal(
      (
        await f.post('/api/agent/check-in', {
          sessionToken: c.sessionToken,
          answers: { ...f.answers, task_type: 'invented' },
        })
      ).status,
      422,
    );
    const blocked = await f.request('/api/lab/search?q=pricing', {
      headers: { Authorization: `Bearer ${c.sessionToken}` },
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).error, 'Check-in required.');
    const response = await f.post('/api/agent/check-in', {
      sessionToken: c.sessionToken,
      answers: f.answers,
    });
    assert.equal(response.status, 200);
    const grant = await response.json();
    assert.notEqual(grant.sessionToken, c.sessionToken);
    assert.equal(grant.identityVerified, false);
    const headers = { Authorization: `Bearer ${grant.sessionToken}` };
    assert.equal((await f.request('/lab/docs', { headers })).status, 200);
    assert.equal((await f.request('/api/lab/search?q=pricing', { headers })).status, 200);
    assert.equal((await f.request('/lab/download/specification.json', { headers })).status, 200);
    const visit = f.store.get(c.sessionId)!;
    assert.equal(visit.objective, f.answers.objective);
    assert.equal(visit.pageCount, 1);
    assert.ok(visit.eventTypes.includes('download'));
    assert.equal(f.store.byToken(c.sessionToken), undefined);
  } finally {
    await f.close();
  }
});

test('permissions, expiry and revocation are enforced on protected routes', async () => {
  const f = await fixture();
  try {
    const { challenge, grant } = await f.admit({ ...f.answers, actions: ['Read pages'] });
    const headers = { Authorization: `Bearer ${grant.sessionToken}` };
    assert.equal((await f.request('/api/lab/search?q=api', { headers })).status, 403);
    assert.equal((await f.request('/lab/download/specification.json', { headers })).status, 403);
    f.store.db
      .prepare('UPDATE sessions SET expires_at=? WHERE id=?')
      .run('2000-01-01T00:00:00.000Z', challenge.sessionId);
    assert.equal(f.store.get(challenge.sessionId)!.status, 'expired');
    assert.equal((await f.request('/lab/docs', { headers })).status, 403);
    const next = await f.admit();
    f.store.revoke(next.challenge.sessionId);
    assert.equal(
      (
        await f.request('/lab/pricing', {
          headers: { Authorization: `Bearer ${next.grant.sessionToken}` },
        })
      ).status,
      403,
    );
    assert.equal(f.store.get(next.challenge.sessionId)!.status, 'revoked');
  } finally {
    await f.close();
  }
});

test('question snapshots remain valid across owner edits; labels are HTML escaped', async () => {
  const f = await fixture();
  try {
    const c = await f.challenge();
    const cookie = await f.bootstrap();
    const original = f.store.site();
    const questions = [
      ...original.questions,
      {
        id: 'evaluation',
        label: '<img src=x onerror=alert(1)> Evaluation criteria?',
        type: 'text' as const,
        required: true,
        options: [],
      },
    ];
    const saved = await f.request('/api/admin/site', {
      method: 'PUT',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: original.name,
        origin: original.origin,
        requireAdmission: true,
        questions,
      }),
    });
    assert.equal(saved.status, 200);
    const old = await f.post('/api/agent/check-in', {
      sessionToken: c.sessionToken,
      answers: f.answers,
    });
    assert.equal(old.status, 200);
    assert.equal(f.store.get(c.sessionId)!.questionsVersion, original.questionsVersion);
    const gate = await f.request('/lab', { headers: { Accept: 'text/html' } });
    const html = await gate.text();
    assert.equal(gate.status, 200);
    assert.ok(html.includes('&lt;img'));
    assert.ok(!html.includes('<img src=x onerror'));
    const next = await f.challenge();
    const invalid = await f.post('/api/agent/check-in', {
      sessionToken: next.sessionToken,
      answers: f.answers,
    });
    assert.equal(invalid.status, 422);
    assert.ok((await invalid.json()).fields.evaluation);
  } finally {
    await f.close();
  }
});

test('browser collector restricts origins, preserves unverified provenance, and accepts voluntary answers', async () => {
  const f = await fixture();
  try {
    const site = f.store.site();
    assert.equal(
      (
        await f.post(
          '/api/collect/site_local',
          { type: 'start', path: '/' },
          { Origin: 'https://wrong.example' },
        )
      ).status,
      403,
    );
    const start = await f.post(
      '/api/collect/site_local',
      {
        type: 'start',
        path: '/pricing?secret=hidden',
        environment: { webdriver: true, language: 'en' },
      },
      { Origin: site.origin },
    );
    assert.equal(start.status, 200);
    assert.equal(start.headers.get('access-control-allow-origin'), site.origin);
    const data = await start.json(),
      headers = { Origin: site.origin, Authorization: `Bearer ${data.sessionToken}` };
    const posted = await f.post(
      '/api/collect/site_local',
      { type: 'check_in', path: '/pricing', answers: f.answers },
      headers,
    );
    assert.equal(posted.status, 200);
    assert.equal((await posted.json()).enforced, false);
    assert.equal(
      (
        await f.post(
          '/api/collect/site_local',
          { type: 'check_in', path: '/', answers: f.answers },
          headers,
        )
      ).status,
      409,
    );
    const event = { id: randomUUID(), type: 'click', path: '/pricing', label: 'Compare plans' };
    await f.post('/api/collect/site_local', { type: 'event', path: '/', event }, headers);
    await f.post('/api/collect/site_local', { type: 'event', path: '/', event }, headers);
    const visit = f.store.get(data.sessionId)!;
    assert.equal(visit.status, 'observed');
    assert.equal(visit.classification, 'automation signals');
    assert.equal(visit.entryPath, '/pricing');
    assert.equal(visit.objective, f.answers.objective);
    assert.ok(
      visit.evidence.find((e) => e.name === 'webdriver' && e.source === 'browser reported'),
    );
    assert.equal(f.store.events(visit.id).filter((e) => e.type === 'click').length, 1);
  } finally {
    await f.close();
  }
});

test('server collection requires a key, is idempotent, and rejects a rotated key', async () => {
  const f = await fixture();
  try {
    const key = f.store.rotateKey();
    const body = {
      eventId: randomUUID(),
      sessionId: 'host-session-123',
      method: 'GET',
      path: '/docs?token=secret',
      status: 200,
      userAgent: 'GPTBot/1.0',
      ip: '203.0.113.42',
    };
    assert.equal((await f.post('/api/ingest', body)).status, 401);
    const first = await f.post('/api/ingest', body, { Authorization: `Bearer ${key}` });
    assert.equal(first.status, 200);
    const data = await first.json();
    assert.equal(data.inserted, true);
    const repeated = await f.post(
      '/api/ingest',
      { ...body, sessionId: 'different-session' },
      { Authorization: `Bearer ${key}` },
    );
    assert.equal((await repeated.json()).inserted, false);
    assert.equal(f.store.list('1970').length, 1);
    const visit = f.store.get(data.sessionId)!;
    assert.equal(visit.entryPath, '/docs');
    assert.ok(visit.evidence.every((e) => e.source === 'integration reported'));
    assert.equal(f.store.events(visit.id).length, 1);
    f.store.rotateKey();
    assert.equal(
      (
        await f.post(
          '/api/ingest',
          { ...body, eventId: randomUUID() },
          { Authorization: `Bearer ${key}` },
        )
      ).status,
      401,
    );
  } finally {
    await f.close();
  }
});

test('export excludes credentials and protects spreadsheet cells from formula execution', async () => {
  const f = await fixture();
  try {
    const { grant } = await f.admit({
      ...f.answers,
      objective: '=HYPERLINK("https://example.com")',
    });
    const cookie = await f.bootstrap();
    const key = f.store.rotateKey();
    const response = await f.request('/api/admin/export', { headers: { Cookie: cookie } });
    const body = await response.text();
    assert.ok(!body.includes(grant.sessionToken));
    assert.ok(!body.includes(key));
    assert.ok(!body.includes('token_hash'));
    assert.ok(!body.includes('ingest_hash'));
    const csv = await (
      await f.request('/api/admin/export?format=csv', { headers: { Cookie: cookie } })
    ).text();
    assert.ok(csv.includes("'=HYPERLINK"));
  } finally {
    await f.close();
  }
});

test('controlled demonstration traverses the actual admission and content endpoints', async () => {
  const f = await fixture();
  try {
    const cookie = await f.bootstrap();
    const response = await f.post('/api/admin/run-demo', {}, { Cookie: cookie });
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json(),
      visit = f.store.get(result.sessionId)!;
    assert.equal(visit.isDemo, true);
    assert.equal(visit.status, 'admitted');
    assert.equal(visit.pageCount, 4);
    assert.ok(visit.eventTypes.includes('search'));
    assert.ok(visit.eventTypes.includes('download'));
  } finally {
    await f.close();
  }
});

test('SQLite retains visits and events after reopening the database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'arrival-'));
  try {
    const file = join(directory, 'test.sqlite');
    let store = new Store(file);
    const result = store.createSession({
      source: 'server',
      userAgent: 'test',
      ip: '127.0.0.1',
      referrer: '',
      entryPath: '/',
      ...{ agentName: 'test', classification: 'unknown' as const, evidence: [] },
    });
    store.event(result.visit.id, 'request', '/docs');
    store.close();
    store = new Store(file);
    assert.equal(store.get(result.visit.id)!.eventCount, 1);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a reporting adapter failure preserves the host response', async () => {
  let report: (error: Error) => void;
  const error = new Promise<Error>((done) => {
    report = done;
  });
  const app = express();
  app.use(
    arrivalAnalytics({
      endpoint: 'http://127.0.0.1:1',
      key: 'not-a-real-key',
      sessionId: () => {
        throw new Error('Host session is unavailable');
      },
      onError: (failure) => report(failure),
    }),
  );
  app.get('/', (_req, res) => res.status(200).send('Host content remains available.'));
  const server = createServer(app);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'Host content remains available.');
    assert.equal((await error).message, 'Host session is unavailable');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
