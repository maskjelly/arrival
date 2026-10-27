import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app.ts';

if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';

const port = Number(process.env.PORT ?? 3000),
  host = process.env.HOST ?? '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.ADMIN_PASSWORD)
  throw new Error('Set ADMIN_PASSWORD before binding a public interface.');
const { app, store } = createApp({
  databasePath: process.env.DATABASE_PATH,
  adminPassword: process.env.ADMIN_PASSWORD,
  trustedProxy: process.env.TRUST_PROXY,
});
const server = createServer(app);
let vite: import('vite').ViteDevServer | undefined;
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: 'custom',
  });
  app.use(vite.middlewares);
  app.get('/{*splat}', async (req, res) => {
    try {
      const template = await readFile(resolve('index.html'), 'utf8');
      res.type('html').send(await vite!.transformIndexHtml(req.originalUrl, template));
    } catch (error) {
      vite?.ssrFixStacktrace(error as Error);
      res.status(500).send('Could not load the dashboard.');
    }
  });
} else {
  app.use(express.static(resolve('dist')));
  // Scope the file to a static root. An absolute sendFile path can be rejected
  // when the checkout itself lives under a hidden directory such as .t3.
  app.get('/{*splat}', (_req, res) => res.sendFile('index.html', { root: resolve('dist') }));
}
server.listen(port, host, () =>
  console.log(
    `Arrival is running at http://${host}:${port}\nStorage: ${process.env.DATABASE_PATH ?? '.data/arrival.sqlite'}\nOwner access: ${process.env.ADMIN_PASSWORD ? 'password protected' : 'local-only bootstrap'}`,
  ),
);
async function shutdown() {
  await vite?.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
