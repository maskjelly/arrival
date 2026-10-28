import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../server/app.ts';
import { handleArrival, seal, unseal, classify } from '../packages/next/core.mjs';

test('workspaces isolate questions, visits, credentials, reports and exports', async () => {
  const { app, store } = await createApp({
    databasePath: ':memory:',
    adminPassword: 'operator-secret',
  });
  const server = createServer(app);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = (path: string, body: any, headers = {}) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  try {
    const a = await post('/api/auth/register', {
      name: 'Client A',
      origin: 'https://a.test',
      slug: 'client-a',
      password: 'customer-a-password',
    });
    assert.equal(a.status, 201);
    const ac = a.headers.get('set-cookie')!.split(';')[0],
      av = await a.json();
    const b = await post('/api/auth/register', {
      name: 'Client B',
      origin: 'https://b.test',
      slug: 'client-b',
      password: 'customer-b-password',
    });
    assert.equal(b.status, 201);
    const bc = b.headers.get('set-cookie')!.split(';')[0],
      bv = await b.json();
    const report = {
      eventId: crypto.randomUUID(),
      sessionId: 'same-host-session',
      method: 'GET',
      path: '/only-a',
      userAgent: 'ExampleAgent',
    };
    const arrivals = await Promise.all([
      post('/api/ingest', report, { Authorization: `Bearer ${av.key}` }),
      post('/api/ingest', { ...report, path: '/only-b' }, { Authorization: `Bearer ${bv.key}` }),
    ]);
    assert.deepEqual(
      arrivals.map((r) => r.status),
      [200, 200],
    );
    const read = async (path: string, cookie: string) => {
      const r = await fetch(base + path, { headers: { Cookie: cookie } });
      return { status: r.status, data: await r.json() };
    };
    const ao = await read('/api/admin/overview', ac),
      bo = await read('/api/admin/overview', bc);
    assert.equal(ao.data.site.name, 'Client A');
    assert.equal(bo.data.site.name, 'Client B');
    assert.equal(ao.data.total, 1);
    assert.equal(bo.data.total, 1);
    assert.equal(ao.data.sessions[0].entryPath, '/only-a');
    assert.equal(bo.data.sessions[0].entryPath, '/only-b');
    assert.equal((await read('/api/admin/sessions/' + ao.data.sessions[0].id, bc)).status, 404);
    const exported = await read('/api/admin/export', bc);
    assert.equal(exported.data.visits.length, 1);
    assert.equal(exported.data.visits[0].entryPath, '/only-b');
    const foreign = await post(
      '/api/collect/' + av.site.id,
      { type: 'start', path: '/' },
      { Origin: 'https://b.test' },
    );
    assert.equal(foreign.status, 403);
    const login = await post('/api/auth/login', {
      workspace: 'client-a',
      password: 'customer-a-password',
    });
    assert.equal(login.status, 200);
    assert.equal(
      (await post('/api/auth/login', { workspace: 'client-b', password: 'customer-a-password' }))
        .status,
      401,
    );
    const pending: Promise<any>[] = [];
    const secret = av.key;
    const cfg = { endpoint: base, siteId: av.site.id, key: secret, clientIp: '8.8.8.8' };
    const first = await handleArrival(
      new Request('https://a.test/only-a?original=kept', {
        headers: { 'user-agent': 'ChatGPT-User/1.0' },
      }),
      cfg,
      { waitUntil: (p: Promise<any>) => pending.push(p) },
    );
    assert.equal(first.response?.status, 200);
    const html = await first.response!.text();
    assert.ok(html.includes('You’re in the right place.'));
    assert.ok(!html.includes(secret));
    assert.ok(!html.includes('Contents of only-a'));
    const state = /name="state" value="([^"]+)"/.exec(html)![1];
    const payload = new URLSearchParams({
      state,
      q_agent_name: 'Natural visitor',
      q_objective: 'Compare the API',
      q_task_type: 'Research',
      m_actions: 'Read pages',
    });
    const incomplete = new URLSearchParams(payload);
    incomplete.delete('q_task_type');
    const validation = await handleArrival(
      new Request('https://a.test/__arrival/check-in', { method: 'POST', body: incomplete }),
      cfg,
    );
    const preserved = await validation.response!.text();
    assert.ok(preserved.includes('Compare the API</textarea>'));
    assert.ok(preserved.includes('A few details are missing.'));
    const answered = await handleArrival(
      new Request('https://a.test/__arrival/check-in', { method: 'POST', body: payload }),
      cfg,
      { waitUntil: (p: Promise<any>) => pending.push(p) },
    );
    assert.equal(answered.response?.status, 303);
    const next = answered.response!.headers.get('location')!;
    assert.ok(next.startsWith('https://a.test/only-a?original=kept'));
    assert.ok(next.includes('__arrival_pass='));
    const continued = await handleArrival(
      new Request(next, { headers: { 'user-agent': 'ChatGPT-User/1.0' } }),
      cfg,
      { waitUntil: (p: Promise<any>) => pending.push(p) },
    );
    assert.equal(continued.response, undefined);
    await Promise.all(pending);
    const detail = await read('/api/admin/overview', ac);
    const visit = detail.data.sessions.find((v: any) => v.agentName === 'Natural visitor');
    assert.equal(visit.objective, 'Compare the API');
    assert.ok(visit.eventTypes.includes('entry_continued'));
    const bad = await handleArrival(
      new Request('https://a.test/only-a?__arrival_pass=forged', {
        headers: { 'user-agent': 'ChatGPT-User/1.0' },
      }),
      cfg,
      { waitUntil: (p: Promise<any>) => pending.push(p) },
    );
    assert.equal(bad.response?.status, 200);
    assert.ok((await bad.response!.text()).includes('<form'));
    const getOnly = await handleArrival(
      new Request('https://a.test/__arrival/check-in?' + payload),
      cfg,
    );
    assert.equal(getOnly.response?.status, 303);
    const browser = await handleArrival(
      new Request('https://a.test/only-a?__arrival_browser=1', {
        headers: { 'user-agent': 'Mozilla/5.0' },
      }),
      cfg,
    );
    assert.ok((await browser.response!.text()).includes('Agent introduction'));
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        post(
          '/api/entry/start',
          { sessionId: 'parallel-page-session', path: '/only-a', userAgent: 'ChatGPT-User' },
          { Authorization: `Bearer ${av.key}` },
        ),
      ),
    );
    const starts = await Promise.all(concurrent.map((r) => r.json()));
    assert.ok(starts.every((d) => d.challenge?.length > 20));
    assert.notEqual(starts[0].challenge, starts[1].challenge);
    const responses = await Promise.all(
      starts.map((d, index) =>
        post(
          '/api/entry/answer',
          {
            challenge: d.challenge,
            answers: {
              agent_name: 'Parallel visitor',
              objective: 'First accepted task ' + index,
              task_type: 'Research',
              actions: ['Read pages'],
            },
          },
          { Authorization: `Bearer ${av.key}` },
        ),
      ),
    );
    assert.deepEqual(
      responses.map((r) => r.status),
      [200, 200],
    );
    const after = await read('/api/admin/overview', ac);
    assert.equal(
      after.data.sessions.filter((v: any) => v.agentName === 'Parallel visitor').length,
      1,
    );
    assert.equal(classify('Googlebot'), 'indexer');
    assert.equal(classify('Mozilla/5.0'), 'unknown');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    store.close();
  }
});

test('entry tokens are purpose, origin, site and expiry bound', async () => {
  const secret = 'not-a-real-integration-key';
  const t = await seal(
    { purpose: 'pass', siteId: 'site_a', origin: 'https://a.test', expires: Date.now() + 10000 },
    secret,
  );
  assert.ok(await unseal(t, secret, 'pass', 'site_a', 'https://a.test'));
  assert.equal(await unseal(t, secret, 'state', 'site_a', 'https://a.test'), undefined);
  assert.equal(await unseal(t, secret, 'pass', 'site_b', 'https://a.test'), undefined);
  assert.equal(await unseal(t, secret, 'pass', 'site_a', 'https://b.test'), undefined);
  assert.equal(await unseal(t, 'wrong-key', 'pass', 'site_a', 'https://a.test'), undefined);
  const expired = await seal(
    { purpose: 'pass', siteId: 'site_a', origin: 'https://a.test', expires: 1 },
    secret,
  );
  assert.equal(await unseal(expired, secret, 'pass', 'site_a', 'https://a.test'), undefined);
});
