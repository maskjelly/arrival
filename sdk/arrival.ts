/** Server-only, best-effort request reporting. This collector does not enforce admission. */
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function arrivalAnalytics(options: {
  endpoint: string;
  key: string;
  sessionId: (request: Request) => string;
  onError?: (error: Error) => void;
}) {
  const endpoint = new URL('/api/ingest', options.endpoint).href;
  return (req: Request, res: Response, next: NextFunction) => {
    const started = performance.now();
    res.once('finish', () => {
      try {
        const body = {
          eventId: randomUUID(),
          sessionId: options.sessionId(req),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          userAgent: (req.get('user-agent') ?? '').slice(0, 1000),
          ip: req.socket.remoteAddress ?? '',
          referrer: (req.get('referer') ?? '').slice(0, 700),
          durationMs: Math.round(performance.now() - started),
        };
        // Reporting failure never changes the host request's response.
        void fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3000),
        })
          .then((response) => {
            if (!response.ok) throw new Error(`Arrival ingestion returned ${response.status}`);
          })
          .catch((error) => options.onError?.(error));
      } catch (error) {
        options.onError?.(
          error instanceof Error ? error : new Error('Arrival could not build the request event.'),
        );
      }
    });
    next();
  };
}
