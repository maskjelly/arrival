import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import type { Store } from './store.ts';
import type { NetworkEnricher } from './geo.ts';
import { reportedNetwork, addressInfo } from './network.ts';
import { cleanPath, cleanReferrer, identify } from './signals.ts';
import type { Question, Visit } from '../src/types.ts';

export function installEntry(
  app: Express,
  store: Store,
  network: NetworkEnricher,
  answerErrors: (questions: Question[], answers: Visit['answers']) => Record<string, string>,
) {
  const auth = async (req: Request, res: Response) => {
    if (!(await store.keyValid((req.get('authorization') ?? '').replace(/^Bearer /i, '')))) {
      res.status(401).json({ error: 'Invalid site integration key.' });
      return false;
    }
    return true;
  };
  app.get('/api/entry/policy/:siteId', async (_req, res) => {
    const site = await store.site();
    res.set('Cache-Control', 'no-store').json({
      siteId: site.id,
      mode: site.entryMode ?? 'observe',
      message: site.entryMessage,
      questions: site.questions,
      version: site.questionsVersion,
    });
  });
  app.post(['/api/entry/start', '/api/entry/browser'], async (req, res) => {
    if (!(await auth(req, res))) return;
    const parsed = z
      .object({
        sessionId: z.string().min(16).max(100),
        path: z.string().max(2000),
        userAgent: z.string().max(1000),
        ip: z.string().max(100).optional(),
        browserAutomation: z.boolean().optional(),
        referrer: z.string().max(700).optional(),
        headers: z.record(z.string(), z.string().max(700)).optional(),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: 'Invalid entry request.' });
      return;
    }
    const b = parsed.data;
    const site = await store.site();
    const browser = req.path.endsWith('/browser');
    if (!browser && site.entryMode !== 'ask') {
      res.json({ mode: 'observe' });
      return;
    }
    let visit = await store.byExternal(`server:${b.sessionId}`);
    if (!visit) {
      const created = await store.createSession({
        source: 'server',
        externalKey: `server:${b.sessionId}`,
        userAgent: b.userAgent,
        ip: addressInfo(b.ip ?? '').ip,
        referrer: cleanReferrer(b.referrer ?? ''),
        entryPath: cleanPath(b.path),
        ...identify(b.userAgent, b.ip ?? '', 'integration reported'),
      });
      visit = created.visit;
    }
    if (browser) {
      res.set('Cache-Control', 'no-store').json({ token: await store.visitorToken(visit.id) });
      return;
    }
    const challenge = await store.entryChallenge(visit.id);
    if (b.browserAutomation)
      await store.environment(visit.id, { webdriver: true }, 'browser reported');
    await store.network(
      visit.id,
      reportedNetwork(b.ip ?? '', network.lookup, { method: 'GET', headers: b.headers }),
    );
    await store.event(
      visit.id,
      'entry_presented',
      cleanPath(b.path),
      { policy: site.entryMode },
      { source: 'integration reported', dedupeKey: `entry-presented:${visit.id}` },
    );
    res.json({
      challenge,
      visitId: visit.id,
      questions: visit.questions,
      version: visit.questionsVersion,
      message: site.entryMessage,
      mode: site.entryMode ?? 'observe',
    });
  });
  app.post('/api/entry/answer', async (req, res) => {
    if (!(await auth(req, res))) return;
    const parsed = z
      .object({
        challenge: z.string().min(20).max(120),
        answers: z.record(
          z.string().max(61),
          z.union([z.string().max(2000), z.array(z.string().max(160)).max(12)]),
        ),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: 'Please provide a short task summary.' });
      return;
    }
    const visit =
      (await store.entryByChallenge(parsed.data.challenge)) ??
      (await store.byToken(parsed.data.challenge));
    if (!visit || visit.source !== 'server' || ['expired', 'revoked'].includes(visit.status)) {
      res.status(401).json({ error: 'This introduction expired. Open the original page again.' });
      return;
    }
    const fields = answerErrors(visit.questions, parsed.data.answers);
    if (Object.keys(fields).length) {
      res.status(422).json({
        error: 'A few details are missing.',
        fields,
        questions: visit.questions,
        message: (await store.site()).entryMessage,
      });
      return;
    }
    if (Object.keys(visit.answers).length) {
      res.json({ ok: true, visitId: visit.id });
      return;
    }
    const inserted = await store.declareOnce(visit.id, parsed.data.answers);
    if (!inserted) {
      res.json({ ok: true, visitId: visit.id });
      return;
    }
    await store.event(
      visit.id,
      'entry_answered',
      visit.entryPath,
      { questionVersion: visit.questionsVersion },
      { source: 'agent reported', dedupeKey: `entry-answered:${visit.id}` },
    );
    res.json({ ok: true, visitId: visit.id });
  });
}
