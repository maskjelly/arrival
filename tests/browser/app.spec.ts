import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';

test('public landing page has interactive examples, build status, and working app navigation', async ({
  page,
}) => {
  const errors: string[] = [];
  const ownerRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/admin') || request.url().includes('/api/auth'))
      ownerRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Get to know why.');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.example-answer')).toContainText('six-person team');
  await expect(page.getByText('Illustrative visit', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Built & next', exact: true }).click();
  await expect(page.getByText('Working today', { exact: true })).toBeVisible();
  await expect(page.getByText('Verified operator identities', { exact: true })).toBeVisible();
  expect(ownerRequests).toEqual([]);
  mkdirSync('.data/screenshots', { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.data/screenshots/landing-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.data/screenshots/landing-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  await page.getByRole('link', { name: 'Explore the workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agent traffic', exact: true })).toBeVisible();
  expect(page.url()).toContain('/app');
  expect(errors).toEqual([]);
});

test('dashboard runs an actual agent and exposes its answers, events and export', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Agent traffic' })).toBeVisible();
  const run = page
    .getByRole('button', { name: /Run a demo agent|Run a controlled HTTP agent/ })
    .first();
  await run.click();
  const drawer = page.getByRole('dialog', { name: 'Visit details' });
  await expect(drawer.getByRole('heading', { name: 'Arrival demo agent' })).toBeVisible();
  await expect(drawer.locator('.objective-block')).toContainText('Compare Northstar');
  await drawer.getByRole('button', { name: /Activity/ }).click();
  await expect(drawer.getByText('File downloaded', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Site searched', { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: 'Signals', exact: true }).click();
  await expect(drawer.getByText('Network address', { exact: true })).toBeVisible();
  await expect(drawer.getByText('request header', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await drawer.getByRole('link', { name: 'Export visit' }).click();
  expect((await download).suggestedFilename()).toBe('arrival-visits.json');
  await drawer.getByRole('button', { name: 'Close visit details' }).click();
  await expect(drawer).not.toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  mkdirSync('.data/screenshots', { recursive: true });
  await page.screenshot({ path: '.data/screenshots/overview.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('a browser completes the gate, navigates and records browser signals', async ({ page }) => {
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Tell us what brings you here.' })).toBeVisible();
  await page.screenshot({ path: '.data/screenshots/check-in.png', fullPage: true });
  await page.getByLabel('Which agent or tool are you using?').fill('Browser research agent');
  await page
    .getByLabel('What are you trying to accomplish here?')
    .fill('Evaluate the Team plan and Python integration.');
  await page.getByLabel('What kind of task is this?').selectOption('Research');
  await page.getByLabel('Read pages', { exact: true }).check();
  await page.getByLabel('Search', { exact: true }).check();
  await page.getByLabel('Download files', { exact: true }).check();
  await page.getByLabel('How did you find this website?').fill('A controlled browser test');
  await page.getByRole('button', { name: 'Declare purpose & continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'A better starting point for your next integration.' }),
  ).toBeVisible();
  await page.getByLabel('Search the demo website').fill('Python');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#search-results')).toContainText('Integrations');
  await page.getByRole('link', { name: 'Pricing', exact: true }).click();
  await page.getByRole('button', { name: 'Save Team to shortlist' }).click();
  await expect(page.getByRole('status')).toContainText('Team added');
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Agent traffic' })).toBeVisible();
  await page
    .getByRole('button', { name: /Browser research agent/ })
    .first()
    .click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('button', { name: 'Signals', exact: true }).click();
  await expect(drawer.getByText('webdriver', { exact: true })).toBeVisible();
  await expect(drawer.getByText('browser reported', { exact: true }).first()).toBeVisible();
});

test('custom questions persist and the interface fits a phone', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Agent traffic' })).toBeVisible();
  await page.getByRole('button', { name: 'Questions', exact: true }).click();
  await page.getByRole('button', { name: /Add a custom question/ }).click();
  await page.locator('.question-label').last().fill('What is your expected evaluation timeline?');
  await page.getByRole('button', { name: 'Save questions' }).click();
  await expect(page.getByRole('status')).toContainText('Questions saved');
  await page.reload();
  await page.getByRole('button', { name: 'Questions', exact: true }).click();
  await expect(page.locator('.question-label').last()).toHaveValue(
    'What is your expected evaluation timeline?',
  );
  await page.screenshot({ path: '.data/screenshots/questions.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agent traffic' })).toBeVisible();
  await expect
    .poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.data/screenshots/mobile.png', fullPage: true });
});

test('an external website collects voluntary answers and annotated activity through the real tracker', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Agent traffic' })).toBeVisible();
  const original = await (await page.request.get('/api/admin/site')).json();
  const host = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><html><head><title>External integration test</title></head><body><h1>Research documentation</h1><p>A controlled host website.</p><button data-arrival-track="Compare SDKs">Compare SDKs</button><div style="height:1400px"></div><script defer src="http://127.0.0.1:3107/tracker.js" data-site="site_local" data-check-in="all"></script></body></html>',
    );
  });
  await new Promise<void>((done) => host.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(host.address() as { port: number }).port}`;
  try {
    const saved = await page.request.put('/api/admin/site', {
      data: {
        name: original.name,
        origin,
        requireAdmission: original.requireAdmission,
        questions: original.questions,
      },
    });
    expect(saved.status()).toBe(200);
    await page.goto(origin);
    const checkIn = page.getByRole('dialog', { name: 'Optional agent check-in' });
    await expect(checkIn).toBeVisible();
    await checkIn.getByLabel('Which agent or tool are you using?').fill('External browser agent');
    await checkIn
      .getByLabel('What are you trying to accomplish here?')
      .fill('Choose an SDK for a client application.');
    await checkIn.getByLabel('What kind of task is this?').selectOption('Research');
    await checkIn.getByLabel('Read pages', { exact: true }).check();
    await checkIn.getByRole('button', { name: 'Share task & continue' }).click();
    await expect(checkIn).not.toBeVisible();
    const recorded = page.waitForResponse(
      (r) => r.url().includes('/api/collect/') && r.request().postDataJSON()?.type === 'event',
    );
    await page.getByRole('button', { name: 'Compare SDKs' }).click();
    await recorded;
    const overview = await (
      await page.request.get('http://127.0.0.1:3107/api/admin/overview')
    ).json();
    const visit = overview.sessions.find(
      (v: { agentName: string }) => v.agentName === 'External browser agent',
    );
    expect(visit).toBeTruthy();
    expect(visit.status).toBe('observed');
    expect(visit.eventTypes).toContain('purpose_declared');
    expect(visit.eventTypes).toContain('click');
    expect(visit.permissions).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    host.closeAllConnections();
    await new Promise<void>((done) => host.close(() => done()));
  }
});
