/** Server-only helper for Next.js, Fetch handlers, and other Web Request runtimes. */
export async function reportArrival(
  request: Request,
  options: {
    endpoint: string;
    key: string | undefined;
    sessionId: string;
    status?: number;
    onError?: (error: Error) => void;
  },
): Promise<boolean> {
  if (!options.key) return false;
  try {
    const response = await fetch(new URL('/api/ingest', options.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.key}` },
      body: JSON.stringify({
        eventId: crypto.randomUUID(),
        sessionId: options.sessionId,
        method: request.method,
        path: new URL(request.url).pathname,
        ...(options.status === undefined ? {} : { status: options.status }),
        userAgent: (request.headers.get('user-agent') ?? '').slice(0, 1000),
        referrer: (request.headers.get('referer') ?? '').slice(0, 700),
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Arrival ingestion returned ${response.status}`);
    return true;
  } catch (error) {
    // Even a failing error hook must not escape into a host request.
    try {
      options.onError?.(error instanceof Error ? error : new Error('Arrival reporting failed.'));
    } catch {}
    return false;
  }
}
