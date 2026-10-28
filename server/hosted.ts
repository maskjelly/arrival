import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.ts';
import { NetworkEnricher } from './geo.ts';

let ready: ReturnType<typeof createApp> | undefined;

async function initialize() {
  if (
    !process.env.ADMIN_PASSWORD ||
    !process.env.TURSO_DATABASE_URL ||
    !process.env.TURSO_AUTH_TOKEN
  )
    throw new Error(
      'Hosted Arrival requires owner authentication and durable database configuration.',
    );
  const origin = process.env.PUBLIC_URL;
  if (!origin || new URL(origin).protocol !== 'https:')
    throw new Error('Hosted Arrival requires an explicit public HTTPS origin.');
  const network = new NetworkEnricher({ readOnly: true });
  await network.load();
  return createApp({
    refreshProviderRanges: true,
    adminPassword: process.env.ADMIN_PASSWORD,
    databaseConnection: {
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    },
    publicOrigin: origin,
    networkService: network,
    backfillOnStart: false,
    // Vercel overwrites X-Forwarded-For at its edge. This entrypoint only runs there.
    trustedProxy: 1,
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!ready)
      ready = initialize().catch((error) => {
        ready = undefined;
        throw error;
      });
    const { app } = await ready;
    app(req, res);
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Arrival is not ready. Check the deployment configuration.' }));
  }
}
