import { defineConfig } from '@playwright/test';
import { rmSync } from 'node:fs';
// This dedicated test database is disposable. Never touch the workspace database.
for (const suffix of ['', '-wal', '-shm'])
  rmSync(`.data/ui-tests.sqlite${suffix}`, { force: true });
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3107', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm start',
    env: {
      PORT: '3107',
      PROVIDER_RANGE_REFRESH: 'false',
      DATABASE_PATH: '.data/ui-tests.sqlite',
      ADMIN_PASSWORD: '',
      NODE_ENV: 'production',
    },
    url: 'http://127.0.0.1:3107/api/health',
    reuseExistingServer: false,
    timeout: 60000,
  },
  reporter: 'list',
  outputDir: '.data/playwright-results',
});
