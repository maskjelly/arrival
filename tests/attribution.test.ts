import test from 'node:test';
import assert from 'node:assert/strict';
import { attributeVisit, referral, safeReferrer } from '../server/attribution.ts';
import { ProviderRanges, parsePrefixes, type RangeFeed } from '../server/provider-ranges.ts';
import { identify } from '../server/signals.ts';
import { Store } from '../server/store.ts';
const feed = (overrides: Partial<RangeFeed> = {}): RangeFeed => ({
  id: 'openai-user',
  provider: 'OpenAI',
  url: 'https://openai.com/chatgpt-user.json',
  checkedAt: new Date().toISOString(),
  prefixes: ['11.12.13.0/24', '2600:1900::/32'],
  ...overrides,
});
const visit = (overrides = {}) => ({
  userAgent: 'ChatGPT-User/1.0',
  ip: '11.12.13.4',
  source: 'server' as const,
  isDemo: false,
  referrer: '',
  environment: {},
  ...overrides,
});

test('provider identity requires both the correct client-specific range and header', () => {
  const ranges = new ProviderRanges([feed()]);
  const matched = attributeVisit(visit(), ranges);
  assert.equal(matched.confidence, 'network corroborated');
  assert.equal(matched.provider, 'OpenAI');
  assert.equal(matched.role, 'User-requested retrieval');
  assert.equal(matched.ipSource, 'integration reported');
  assert.equal(matched.rangeCheck?.prefix, '11.12.13.0/24');
  assert.equal(
    attributeVisit(visit({ ip: '::ffff:11.12.13.4' }), ranges).confidence,
    'network corroborated',
  );
  assert.equal(
    attributeVisit(visit({ ip: '2600:1900::123' }), ranges).confidence,
    'network corroborated',
  );
  assert.equal(attributeVisit(visit({ ip: '11.12.14.4' }), ranges).confidence, 'header claim only');
  assert.equal(
    attributeVisit(visit({ userAgent: 'GPTBot/1.0' }), ranges).confidence,
    'header claim only',
  );
  assert.equal(
    attributeVisit(visit({ userAgent: 'ChatGPT-User/1.0 Claude-User/1.0' }), ranges).confidence,
    'conflicting claims',
  );
  assert.equal(attributeVisit(visit({ ip: '127.0.0.1' }), ranges).confidence, 'header claim only');
  assert.equal(attributeVisit(visit({ ip: 'invalid' }), ranges).confidence, 'header claim only');
  const ipOnly = attributeVisit(visit({ userAgent: 'Mozilla/5.0' }), ranges);
  assert.equal(ipOnly.confidence, 'network match only');
  assert.equal(ipOnly.role, 'Not established');
  assert.equal(ipOnly.provider, 'OpenAI');
  assert.equal(
    attributeVisit(visit({ userAgent: 'NotChatGPT-User/1.0', ip: '' }), ranges).provider,
    'Unidentified',
  );
  assert.equal(attributeVisit(visit({ isDemo: true }), ranges).confidence, 'header claim only');
});
test('stale or invalid snapshots never corroborate identity and roles do not become objectives', () => {
  for (const checkedAt of [
    new Date(Date.now() - 8 * 86400000).toISOString(),
    'invalid',
    new Date(Date.now() + 86400000).toISOString(),
  ]) {
    const context = attributeVisit(visit(), new ProviderRanges([feed({ checkedAt })]));
    assert.equal(context.confidence, 'header claim only');
    assert.equal(context.rangeCheck?.status, 'stale');
  }
  const ranges = new ProviderRanges([]);
  for (const [userAgent, provider, role] of [
    ['Claude-SearchBot/1.0', 'Anthropic', 'Search indexing'],
    ['ClaudeBot/1.0', 'Anthropic', 'Model training crawl'],
    ['Claude-User/1.0', 'Anthropic', 'User-requested retrieval'],
    ['PerplexityBot/1.0', 'Perplexity', 'Search indexing'],
    ['OAI-AdsBot/1.0', 'OpenAI', 'Ad review'],
  ]) {
    const result = attributeVisit(visit({ userAgent }), ranges);
    assert.equal(result.provider, provider);
    assert.equal(result.role, role);
    assert.equal(identify(userAgent, '').agentName, userAgent.split('/')[0]);
    assert.equal('objective' in result, false);
  }
});
test('referral capture preserves only supplied recognized search terms and cannot invent discovery', () => {
  const clean = safeReferrer(
    'https://user:password@www.google.com/search?q=sqlite+for+agents&token=secret&email=a%40b.com#private',
  );
  assert.equal(clean, 'https://www.google.com/search?q=sqlite+for+agents');
  const result = referral(clean);
  assert.equal(result.source, 'Google');
  assert.equal(result.searchQuery, 'sqlite for agents');
  assert.equal(referral('https://www.google.com/').searchQuery, undefined);
  assert.equal(referral('https://google.com.evil.test/search?q=secret').kind, 'website');
  assert.equal(
    referral('https://search.yahoo.com/search?p=agent+analytics&session=secret').searchQuery,
    'agent analytics',
  );
  assert.equal(referral('https://chatgpt.com/c/private?prompt=secret').kind, 'AI referral');
  assert.equal(
    safeReferrer('https://example.com/docs?token=secret&q=secret'),
    'https://example.com/docs',
  );
  assert.equal(safeReferrer('javascript:alert(1)'), '');
  assert.equal(referral('').kind, 'unavailable');
  assert.equal(referral('https://whiteye.in/docs', 'https://whiteye.in').kind, 'internal');
  assert.equal(
    referral('https://www.google.com/search?q=' + 'a'.repeat(1000)).searchQuery?.length,
    300,
  );
});
test('range refresh coalesces, validates feeds and retains good data on failures', async () => {
  const ranges = new ProviderRanges([feed()]);
  let requests = 0;
  const failing = (async () => {
    requests++;
    throw new Error('offline');
  }) as typeof fetch;
  await Promise.all([ranges.refresh(failing), ranges.refresh(failing)]);
  assert.equal(requests, 9);
  assert.equal(ranges.snapshot().length, 1);
  assert.equal(ranges.matches('11.12.13.4').length, 1);
  await ranges.refresh(failing);
  assert.equal(requests, 9);
  assert.throws(() => parsePrefixes({ prefixes: [{ ipv4Prefix: '0.0.0.0/0' }] }));
  assert.throws(() => parsePrefixes({ prefixes: [] }));
  assert.throws(() => parsePrefixes({ prefixes: [{ ipv4Prefix: 'garbage' }] }));
  assert.deepEqual(parsePrefixes({ prefixes: [{ ipv6Prefix: '2600:1900::/32' }] }), [
    '2600:1900::/32',
  ]);
  const fresh = new ProviderRanges([]);
  await fresh.refresh(
    (async () =>
      new Response(
        JSON.stringify({ prefixes: [{ ipv4Prefix: '11.12.13.0/24' }] }),
      )) as typeof fetch,
  );
  assert.equal(fresh.snapshot().length, 9);
});
test('existing stored visits gain attribution and ordered journeys without rewriting declarations', async () => {
  const store = new Store(':memory:');
  try {
    const created = await store.createSession({
      source: 'server',
      userAgent: 'Claude-SearchBot/1.0',
      ip: '',
      referrer: 'https://www.google.com/search?q=agent+analytics',
      entryPath: '/docs',
      agentName: 'Old unknown record',
      classification: 'unknown',
      evidence: [],
    });
    await store.event(
      created.visit.id,
      'request',
      '/docs',
      {},
      { source: 'integration reported', dedupeKey: 'one' },
    );
    await store.event(
      created.visit.id,
      'request',
      '/docs',
      {},
      { source: 'integration reported', dedupeKey: 'one' },
    );
    await store.event(created.visit.id, 'click', '/pricing', {}, { source: 'browser reported' });
    for (let i = 0; i < 18; i++)
      await store.event(
        created.visit.id,
        'page_view',
        `/page-${i}`,
        {},
        { source: 'browser reported' },
      );
    await store.declare(created.visit.id, { agent_name: 'My custom name' }, 'agent reported');
    const read = (await store.get(created.visit.id))!;
    assert.equal(read.agentName, 'My custom name');
    assert.equal(read.classification, 'self-identifying bot');
    assert.equal(read.attribution?.client, 'Claude-SearchBot');
    assert.equal(read.attribution?.provider, 'Anthropic');
    assert.equal(read.attribution?.referral.searchQuery, 'agent analytics');
    assert.equal(read.objective, '');
    assert.equal(read.journey?.steps.length, 16);
    assert.equal(read.journey?.total, 20);
    assert.equal(read.journey?.steps[0].path, '/docs');
    assert.equal(read.journey?.steps[1].path, '/pricing');
    assert.equal(read.journey?.lastPath, '/page-17');
    assert.equal(read.journey?.steps[1].source, 'browser reported');
  } finally {
    store.close();
  }
});

test('server demo reports are consistently marked and cannot receive provider corroboration', async () => {
  const store = new Store(':memory:');
  try {
    const created = await store.createSession({
      source: 'server',
      userAgent: 'Arrival-DemoAgent/1.0',
      ip: '',
      referrer: '',
      entryPath: '/',
      agentName: 'Demo',
      classification: 'unknown',
      evidence: [],
    });
    assert.equal(identify('AhrefsBot/7.0', '').classification, 'self-identifying bot');
    assert.equal(created.visit.isDemo, true);
    assert.equal((await store.list('1970'))[0].isDemo, true);
    assert.match(created.visit.attribution!.explanation, /Controlled demo/);
    assert.equal(
      attributeVisit(
        visit({ userAgent: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)' }),
        new ProviderRanges([]),
      ).provider,
      'Ahrefs',
    );
  } finally {
    store.close();
  }
});
