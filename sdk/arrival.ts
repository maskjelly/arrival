/** Server-only, best-effort request reporting. This collector does not enforce admission. */
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function arrivalAnalytics(options: {
  endpoint: string;
  key: string | undefined;
  siteId?: string;
  sessionId?: (request: Request) => string;
  onError?: (error: Error) => void;
}) {
  const reportError = (error: unknown) => {
    try {
      options.onError?.(error instanceof Error ? error : new Error('Arrival reporting failed.'));
    } catch {}
  };
  let endpoint: string | undefined;
  try {
    endpoint = new URL('/api/ingest', options.endpoint).href;
  } catch (error) {
    reportError(error);
  }
  return (req: Request, res: Response, next: NextFunction) => {
    if (!endpoint || !options.key) {
      next();
      return;
    }
    const target = endpoint;
    const started = performance.now();
    res.append(
      'Link',
      `<${new URL(`/api/agent/manifest/${encodeURIComponent(options.siteId ?? 'site_local')}`, endpoint).href}>; rel="alternate"; type="application/json"; title="Optional agent check-in"`,
    );
    // Works without a separate session package. This opaque cookie is not identity verification.
    const incoming = /(?:^|;\s*)arrival_sid=([a-zA-Z0-9_-]{20,120})(?:;|$)/.exec(
      req.headers.cookie ?? '',
    )?.[1];
    const sessionId = incoming ?? randomUUID();
    if (!options.sessionId && !incoming)
      res.cookie('arrival_sid', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure,
        maxAge: 86400000,
      });
    res.once('finish', () => {
      try {
        const body = {
          eventId: randomUUID(),
          sessionId: options.sessionId ? options.sessionId(req) : sessionId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          userAgent: (req.get('user-agent') ?? '').slice(0, 1000),
          ip: req.ip ?? '',
          referrer: (req.get('referer') ?? '').slice(0, 700),
          durationMs: Math.round(performance.now() - started),
        };
        // Reporting failure never changes the host request's response.
        void fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3000),
        })
          .then((response) => {
            if (!response.ok) throw new Error(`Arrival ingestion returned ${response.status}`);
          })
          .catch(reportError);
      } catch (error) {
        reportError(error);
      }
    });
    next();
  };
}
