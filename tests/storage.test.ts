import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.ts';
import handler from '../server/hosted.ts';
import { createServer } from 'node:http';

test('independent storage clients preserve concurrent session ingestion and snapshots', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'arrival-concurrency-'));
  const path = join(dir, 'shared.sqlite');
  const first = new Store(path),
    second = new Store(path);
  try {
    await Promise.all([first.ready, second.ready]);
    const input = {
      source: 'server' as const,
      userAgent: 'Controlled test',
      ip: '',
      referrer: '',
      entryPath: '/docs',
      agentName: 'Controlled test',
      classification: 'unknown' as const,
      evidence: [],
      externalKey: 'shared-host-session',
    };
    const visits = await Promise.all([first.createSession(input), second.createSession(input)]);
    assert.equal(visits[0].visit.id, visits[1].visit.id);
    const results = await Promise.all([
      first.event(visits[0].visit.id, 'request', '/docs', {}, { dedupeKey: 'same-request' }),
      second.event(visits[0].visit.id, 'request', '/docs', {}, { dedupeKey: 'same-request' }),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    await first.declare(
      visits[0].visit.id,
      { objective: 'Retain the original task' },
      'agent reported',
    );
    assert.equal((await second.get(visits[0].visit.id))?.objective, 'Retain the original task');
    assert.equal((await second.list('1970')).length, 1);
  } finally {
    first.close();
    second.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hosted entrypoint fails closed without durable storage and owner configuration', async () => {
  // This test process has no hosted credentials. A hosted function must never use ephemeral SQLite.
  const saved = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  const server = createServer(handler);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  try {
    const r = await fetch(
      `http://127.0.0.1:${(server.address() as { port: number }).port}/api/health`,
    );
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), {
      error: 'Arrival is not ready. Check the deployment configuration.',
    });
  } finally {
    if (saved !== undefined) process.env.ADMIN_PASSWORD = saved;
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
