import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.ts';
import { NetworkEnricher } from '../server/geo.ts';
import { addressInfo, hostingHint, safeHeaders } from '../server/network.ts';
import { Store } from '../server/store.ts';
import type { NetworkLookup } from '../src/types.ts';

const fixtureLookup = (ip: string): NetworkLookup =>
  addressInfo(ip).scope === 'public'
    ? {
        enrichment: {
          status: 'enriched',
          source: 'Isolated test fixture',
          cityBuiltAt: '2026-10-01T00:00:00.000Z',
          asnBuiltAt: '2026-10-01T00:00:00.000Z',
        },
        location: {
          country: 'United States',
          countryCode: 'US',
          region: 'California',
          city: 'Mountain View',
          approximate: true,
        },
        asn: { number: 15169, organization: 'Google LLC', prefixLength: 24 },
        hosting: {
          provider: 'Google network',
          kind: 'cloud / hosting / CDN',
          confidence: 'inferred',
        },
      }
    : { enrichment: { status: 'non-public address' } };
async function system(trustedProxy?: string, databasePath = ':memory:') {
  const network = new NetworkEnricher();
  network.lookup = fixtureLookup;
  const { app, store } = createApp({ databasePath, trustedProxy, networkService: network });
  const server = createServer(app);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = (path: string, init: RequestInit = {}) => fetch(base + path, init);
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const owner = async () => {
    const r = await post('/api/auth/local', {});
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie')!.split(';')[0];
  };
  const close = async () => {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    store.close();
  };
  return { request, post, owner, close, store, network };
}

test('address normalization excludes private, reserved and malformed addresses from public enrichment', () => {
  assert.deepEqual(addressInfo('::ffff:8.8.8.8'), { ip: '8.8.8.8', version: 4, scope: 'public' });
  assert.equal(addressInfo('2001:4860:4860::8888').version, 6);
  assert.equal(addressInfo('2001:4860:4860::8888').scope, 'public');
  for (const value of [
    '127.0.0.1',
    '10.1.2.3',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '203.0.113.5',
    '2001:db8::1',
    'not-an-ip',
  ])
    assert.notEqual(addressInfo(value).scope, 'public', value);
  assert.equal(hostingHint('Google LLC')?.confidence, 'inferred');
  assert.equal(hostingHint('Unknown organization'), undefined);
  assert.deepEqual(
    safeHeaders({
      'accept-language': 'en-US',
      cookie: 'SECRET',
      authorization: 'Bearer SECRET',
      'x-api-key': 'SECRET',
      accept: 'text/html\n',
    }),
    { accept: 'text/html', 'accept-language': 'en-US' },
  );
});

test('untrusted forwarding and country headers cannot replace the observed connection address', async () => {
  const f = await system();
  try {
    const r = await f.request('/lab', {
      headers: {
        Accept: 'application/json',
        'X-Forwarded-For': '8.8.8.8',
        'CF-Connecting-IP': '8.8.8.8',
        'CF-IPCountry': 'US',
      },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    const visit = f.store.byToken(data.sessionToken)!;
    assert.equal(visit.network?.ip, '127.0.0.1');
    assert.equal(visit.network.ipSource, 'direct connection');
    assert.equal(visit.network.enrichment.status, 'non-public address');
    assert.equal(visit.network.location, undefined);
  } finally {
    await f.close();
  }
});

test('trusted proxies preserve peer provenance, resolve the exit address and record address changes', async () => {
  const f = await system('loopback');
  try {
    const r = await f.request('/lab', {
      headers: {
        Accept: 'application/json',
        'X-Forwarded-For': '8.8.8.8',
        'CF-IPCountry': 'FR',
        'Accept-Language': 'en-US',
      },
    });
    const data = await r.json();
    const first = f.store.byToken(data.sessionToken)!;
    assert.equal(first.network?.ip, '8.8.8.8');
    assert.equal(first.network.peerIp, '127.0.0.1');
    assert.equal(first.network.ipSource, 'trusted proxy');
    assert.equal(first.network.location?.countryCode, 'US');
    assert.equal(first.network.asn?.number, 15169);
    assert.equal(first.network.request.headers?.['accept-language'], 'en-US');
    const next = await f.request('/lab/docs', {
      headers: {
        Authorization: `Bearer ${data.sessionToken}`,
        'X-Forwarded-For': '2001:4860:4860::8888',
      },
    });
    assert.equal(next.status, 200);
    const visit = f.store.get(first.id)!;
    assert.equal(visit.ip, '8.8.8.8');
    assert.equal(visit.network?.version, 6);
    assert.equal(visit.network.history?.length, 2);
    assert.ok(visit.eventTypes.includes('network_changed'));
    const cookie = await f.owner();
    const overview = await (
      await f.request('/api/admin/overview', { headers: { Cookie: cookie } })
    ).json();
    assert.equal(overview.network.located, 1);
    assert.equal(overview.network.countryCount, 1);
    assert.equal(overview.network.providers[0].name, 'Google LLC');
  } finally {
    await f.close();
  }
});

test('reported requests keep integration provenance and never substitute the reporter IP', async () => {
  const f = await system();
  try {
    const key = f.store.rotateKey();
    const headers = { Authorization: `Bearer ${key}` };
    const body = {
      eventId: randomUUID(),
      sessionId: 'host-request-a',
      method: 'GET',
      path: '/docs',
      userAgent: 'TestAgent/1',
      headers: {
        'accept-language': 'en',
        authorization: 'SHOULD_NOT_BE_STORED',
        cookie: 'SHOULD_NOT_BE_STORED',
      },
      scheme: 'https',
    };
    const response = await f.post('/api/ingest', body, headers);
    assert.equal(response.status, 200);
    const id = (await response.json()).sessionId;
    const noIP = f.store.get(id)!;
    assert.equal(noIP.ip, '');
    assert.equal(noIP.network?.ip, '');
    assert.equal(noIP.network.ipSource, 'integration reported');
    assert.equal(noIP.network.location, undefined);
    const enriched = await f.post(
      '/api/ingest',
      { ...body, eventId: randomUUID(), ip: '8.8.8.8' },
      headers,
    );
    assert.equal(enriched.status, 200);
    const visit = f.store.get(id)!;
    assert.equal(visit.network?.location?.countryCode, 'US');
    assert.equal(visit.network.ipSource, 'integration reported');
    assert.equal(visit.network.peerIp, undefined);
    assert.ok(!JSON.stringify(visit).includes('SHOULD_NOT_BE_STORED'));
    const cookie = await f.owner();
    const exported = await (
      await f.request('/api/admin/export', { headers: { Cookie: cookie } })
    ).text();
    assert.ok(!exported.includes('SHOULD_NOT_BE_STORED'));
    assert.match(exported, /networkAttribution/);
    assert.match(exported, /Isolated test fixture/);
  } finally {
    await f.close();
  }
});

test('missing databases and failed updates leave analytics and website content available', async () => {
  const geo = new NetworkEnricher({
    cityPath: '/does-not-exist/city.mmdb',
    asnPath: '/does-not-exist/asn.mmdb',
  });
  await geo.load();
  assert.equal(geo.status().enabled, false);
  assert.equal(geo.lookup('8.8.8.8').enrichment.status, 'not installed');
  assert.equal(geo.lookup('127.0.0.1').enrichment.status, 'non-public address');
  await geo.update('invalid-month');
  assert.equal(geo.status().job.running, false);
  assert.ok(geo.status().job.error);
  const f = await system();
  try {
    assert.equal((await f.request('/api/admin/network')).status, 401);
    const cookie = await f.owner();
    let starts = 0;
    f.network.update = async () => {
      starts++;
    };
    assert.equal(
      (
        await f.post(
          '/api/admin/network/update',
          {},
          { Cookie: cookie, Origin: 'https://attacker.example' },
        )
      ).status,
      403,
    );
    assert.equal(starts, 0);
    assert.equal((await f.post('/api/admin/network/update', {}, { Cookie: cookie })).status, 202);
    assert.equal(starts, 1);
    assert.equal((await f.request('/lab/pricing')).status, 200);
  } finally {
    await f.close();
  }
});

test('existing SQLite visits migrate intact and backfill does not invent a historical capture source', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'arrival-network-'));
  try {
    const path = join(directory, 'visits.sqlite');
    let store = new Store(path);
    const session = store.createSession({
      source: 'gateway',
      userAgent: 'TestAgent',
      ip: '8.8.8.8',
      referrer: '',
      entryPath: '/docs',
      agentName: 'Existing agent',
      classification: 'unknown',
      evidence: [],
    });
    store.declare(session.visit.id, { objective: 'Keep my original task' });
    const original = store.site();
    store.db.exec('ALTER TABLE sessions DROP COLUMN network');
    store.close();
    store = new Store(path);
    assert.equal(store.get(session.visit.id)!.objective, 'Keep my original task');
    assert.equal(store.get(session.visit.id)!.network, undefined);
    store.close();
    const f = await system(undefined, path);
    try {
      const cookie = await f.owner();
      assert.equal(
        (await f.post('/api/admin/network/backfill', {}, { Cookie: cookie })).status,
        200,
      );
      const visit = f.store.get(session.visit.id)!;
      assert.equal(visit.network?.ipSource, 'stored address');
      assert.equal(visit.network.location?.countryCode, 'US');
      assert.deepEqual(f.store.site(), original);
    } finally {
      await f.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
