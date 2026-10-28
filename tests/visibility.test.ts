import test from 'node:test';
import assert from 'node:assert/strict';
import { attributeVisit, safeReferrer } from '../server/attribution.ts';
import { Store } from '../server/store.ts';
import { visibilityReport } from '../server/visibility.ts';

test('visitor categories distinguish published crawlers, retrieval clients and unidentified automation', () => {
  const base = { source: 'server' as const, ip: '', referrer: '', environment: {}, isDemo: false };
  for (const [userAgent, kind] of [
    ['ClaudeBot/1.0', 'crawler'],
    ['Claude-User/1.0', 'agent'],
    ['curl/8.0', 'automation'],
    ['Mozilla/5.0', 'unidentified'],
    ['ClaudeBot/1.0 GPTBot/1.0', 'unidentified'],
  ]) {
    assert.equal(attributeVisit({ ...base, userAgent }).trafficType, kind);
  }
  const browser = { ...base, userAgent: 'Mozilla/5.0', environment: { webdriver: true } };
  assert.equal(attributeVisit(browser).trafficType, 'automation');
  const declared = attributeVisit({
    ...browser,
    answers: { agent_name: 'My agent', objective: 'Compare prices' },
  });
  assert.equal(declared.trafficType, 'agent');
  assert.match(declared.trafficTypeBasis!, /self-reported/);
});

test('visibility couples supplied discovery with the same visit, never a guessed query or later landing page', async () => {
  const store = new Store(':memory:');
  try {
    const make = async (userAgent: string, referrer = '', isDemo = false) =>
      (
        await store.createSession({
          source: 'server',
          userAgent,
          ip: '',
          referrer: safeReferrer(referrer),
          entryPath: '/docs',
          agentName: userAgent,
          classification: 'unknown',
          evidence: [],
          isDemo,
        })
      ).visit;
    const crawler = await make(
      'Claude-SearchBot/1.0',
      'https://www.google.com/search?q=agent+analytics&token=secret',
    );
    await store.event(crawler.id, 'request', '/docs', {});
    await store.event(crawler.id, 'request', '/pricing', {});
    const agent = await make('Claude-User/1.0');
    await store.declare(
      agent.id,
      { objective: 'Compare analytics', discovery: 'I searched for analytics' },
      'agent reported',
    );
    await make('GPTBot/1.0', '', true);
    const report = await visibilityReport(store, '1970');
    assert.equal(report.totals.visits, 2);
    assert.equal(report.totals.crawlers, 1);
    assert.equal(report.totals.agents, 1);
    assert.equal(report.totals.withQuery, 1);
    assert.equal(report.scope.excludedDemos, 1);
    assert.equal(report.queries[0].query, 'agent analytics');
    assert.equal(report.queries[0].page, '/docs');
    assert.deepEqual(report.pages.find((p) => p.path === '/pricing')?.queries, []);
    const a = report.records.find((r) => r.id === agent.id)!;
    assert.equal(a.query, undefined);
    assert.equal(a.declaredSource, 'I searched for analytics');
    assert.equal(a.reasonBasis, 'declared');
    const c = report.records.find((r) => r.id === crawler.id)!;
    assert.equal(c.lastPath, '/pricing');
    assert.ok(c.tags.includes('Pricing visited'));
    assert.equal(c.reasonBasis, 'published role');
    const filtered = await visibilityReport(store, '1970', {
      query: 'agent analytics',
      page: '/pricing',
      kind: 'crawler',
    });
    assert.deepEqual(
      filtered.records.map((r) => r.id),
      [crawler.id],
    );
    assert.equal((await visibilityReport(store, '1970', { includeDemo: true })).totals.visits, 3);
    assert.equal((await visibilityReport(store, '1970', { offset: 1 }, 1)).records.length, 1);
  } finally {
    store.close();
  }
});

test('visibility paginates beyond the overview sample without repeating records', async () => {
  const store = new Store(':memory:');
  try {
    for (let i = 0; i < 305; i++)
      await store.createSession({
        source: 'server',
        userAgent: 'GPTBot/1.0',
        ip: '',
        referrer: '',
        entryPath: `/page-${i}`,
        agentName: 'GPTBot',
        classification: 'unknown',
        evidence: [],
      });
    const first = await visibilityReport(store, '1970');
    const next = await visibilityReport(store, '1970', { offset: 50 });
    const last = await visibilityReport(store, '1970', { offset: 300 });
    assert.equal(first.totals.visits, 305);
    assert.equal(first.records.length, 50);
    assert.equal(first.hasMore, true);
    assert.ok(next.records.every((r) => !first.records.some((f) => f.id === r.id)));
    assert.equal(last.records.length, 5);
    assert.equal(last.hasMore, false);
    assert.equal((await visibilityReport(store, '1970', {}, 5000)).records.length, 305);
  } finally {
    store.close();
  }
});
