import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { installSnippet } from '../../src/install.ts';
import AxeBuilder from '@axe-core/playwright';

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

test('a browser browses freely, optionally shares its task and records browser signals', async ({
  page,
}) => {
  await page.goto('/lab');
  await expect(
    page.getByRole('heading', { name: 'A better starting point for your next integration.' }),
  ).toBeVisible();
  const optional = page.locator('[data-arrival-check-in]');
  await optional.locator('summary').click();
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
  await page.getByRole('button', { name: 'Share task', exact: true }).click();
  await expect(optional).not.toBeAttached();
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
  await page.getByRole('link', { name: 'Questions', exact: true }).click();
  await page.getByRole('button', { name: /Add a custom question/ }).click();
  await page.locator('.question-label').last().fill('What is your expected evaluation timeline?');
  await page.getByRole('button', { name: 'Save questions' }).click();
  await expect(page.getByRole('status')).toContainText('Questions saved');
  await page.reload();
  await page.getByRole('link', { name: 'Questions', exact: true }).click();
  await expect(page.locator('.question-label').last()).toHaveValue(
    'What is your expected evaluation timeline?',
  );
  await page.screenshot({ path: '.data/screenshots/questions.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agent traffic' })).toBeVisible();
  await expect
    .poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.data/screenshots/mobile.png', fullPage: true });
});

test('installation setup offers copyable platform snippets and checks real collection', async ({
  page,
}) => {
  await page.goto('/app');
  await page.getByRole('link', { name: 'Connect a website', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Paste once. Keep browsing.' })).toBeVisible();
  await page.getByRole('tab', { name: 'Wix', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Settings → Custom Code');
  await expect(page.getByRole('tabpanel').locator('pre')).toContainText('data-site="site_local"');
  await page.getByRole('tab', { name: 'Shopify', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('theme.liquid');
  await page.getByRole('tab', { name: 'Next.js', exact: true }).click();
  await expect(page.getByRole('tabpanel').locator('pre')).toContainText(
    'strategy="afterInteractive"',
  );
  await page.getByRole('button', { name: 'Check installation', exact: true }).click();
  await expect(page.locator('.install-verification [role="status"]')).toContainText(
    'No browser data',
  );
  await page.screenshot({ path: '.data/screenshots/install-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect
    .poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  await page.screenshot({ path: '.data/screenshots/install-mobile.png', fullPage: true });
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
      `<!doctype html><html><head><title>External integration test</title>${installSnippet('http://127.0.0.1:3107', 'site_local', 'all', 'html')}</head><body><h1>Research documentation</h1><p>A controlled host website.</p><button data-arrival-track="Compare SDKs">Compare SDKs</button><div style="height:1400px"></div></body></html>`,
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
    const checkIn = page.locator('[data-arrival-check-in]');
    await expect(checkIn).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Research documentation' })).toBeVisible();
    expect(await page.locator('body').evaluate((el) => el.hasAttribute('inert'))).toBe(false);
    await checkIn.locator('summary').click();
    await checkIn.getByLabel('Which agent or tool are you using?').fill('External browser agent');
    await checkIn
      .getByLabel('What are you trying to accomplish here?')
      .fill('Choose an SDK for a client application.');
    await checkIn.getByLabel('What kind of task is this?').selectOption('Research');
    await checkIn.getByLabel('Read pages', { exact: true }).check();
    await checkIn.getByRole('button', { name: 'Share task', exact: true }).click();
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
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-arrival-check-in]')).toHaveCount(0);
    const nextOverview = await (
      await page.request.get('http://127.0.0.1:3107/api/admin/overview')
    ).json();
    expect(nextOverview.sessions.filter((v: { id: string }) => v.id === visit.id)).toHaveLength(1);
    expect(nextOverview.sessions.find((v: { id: string }) => v.id === visit.id).pageCount).toBe(2);
    await page.evaluate(() => {
      history.pushState({}, '', '/pricing?private=discard');
      history.replaceState({}, '', '/pricing?private=also-discard');
    });
    await expect
      .poll(async () => {
        const data = await (
          await page.request.get('http://127.0.0.1:3107/api/admin/sessions/' + visit.id)
        ).json();
        return data.visit.pageCount;
      })
      .toBe(3);
    // Duplicate snippets must not double-count a page or wrap the history API twice.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'http://127.0.0.1:3107/tracker.js';
          script.dataset.site = 'site_local';
          script.onload = () => resolve();
          document.head.append(script);
        }),
    );
    const detail = await (
      await page.request.get('http://127.0.0.1:3107/api/admin/sessions/' + visit.id)
    ).json();
    expect(detail.visit.pageCount).toBe(3);
    expect(
      detail.events.find(
        (e: { type: string; path: string }) => e.type === 'page_view' && e.path === '/pricing',
      ),
    ).toBeTruthy();
    const installation = await (
      await page.request.get('http://127.0.0.1:3107/api/admin/installation')
    ).json();
    expect(installation.browser.lastSeen).toBeTruthy();
    // A fresh agent can skip once; navigation keeps working and does not prompt again.
    const freshContext = await page.context().browser()!.newContext();
    try {
      const fresh = await freshContext.newPage();
      await fresh.goto(origin);
      const prompt = fresh.locator('[data-arrival-check-in]');
      await prompt.locator('summary').click();
      await prompt.getByRole('button', { name: 'Skip', exact: true }).click();
      await fresh.reload({ waitUntil: 'networkidle' });
      await expect(fresh.locator('[data-arrival-check-in]')).toHaveCount(0);
      await expect(fresh.getByRole('heading', { name: 'Research documentation' })).toBeVisible();
      // Collection outage must leave the website usable and readiness must settle.
      await fresh.route('**/api/collect/**', (route) => route.abort());
      await fresh.reload();
      const ready = await fresh.evaluate(
        () => (window as unknown as { arrival: { ready: Promise<{ ok: boolean }> } }).arrival.ready,
      );
      expect(ready.ok).toBe(false);
      await expect(fresh.getByRole('heading', { name: 'Research documentation' })).toBeVisible();
    } finally {
      await freshContext.close();
    }
    expect(errors).toEqual([]);
  } finally {
    host.closeAllConnections();
    await new Promise<void>((done) => host.close(() => done()));
  }
});

test('workspace views support direct links, keyboard navigation and accessible contrast', async ({
  page,
}) => {
  for (const view of ['overview', 'sessions', 'origins', 'questions', 'integration', 'project']) {
    await page.goto('/app?view=' + view);
    await expect(page.locator('.page-heading h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations, view).toEqual([]);
  }
  await page.goto('/app?view=integration');
  await expect(
    page.getByRole('heading', { name: 'Connect your website', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Any website', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Wix', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Wix', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Visits', exact: false }).first().click();
  await expect(page).toHaveURL(/view=sessions/);
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Connect your website', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Connect a website', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle navigation', exact: true })).toBeFocused();
  expect(await page.locator('.app-body').getAttribute('inert')).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobile = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(mobile.violations).toEqual([]);
  await page.goto('/app?view=sessions');
  await page.locator('.mobile-visit-card').first().click();
  const drawer = page.getByRole('dialog', { name: 'Visit details' });
  await expect(drawer).toBeVisible();
  for (const tab of ['Task & answers', 'Network', 'Activity', 'Signals', 'Raw data']) {
    await drawer.getByRole('button', { name: tab, exact: tab !== 'Activity' }).click();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations, tab).toEqual([]);
  }
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
});

test('connection origins expose capture provenance and searchable network details on desktop and phone', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app?view=origins');
  await expect(page.getByRole('heading', { name: 'Where visits connect from' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search connection evidence' }).fill('127.0.0.1');
  const visit = page.getByRole('button', { name: /Inspect network for/ }).first();
  await expect(visit).toBeVisible();
  await visit.click();
  const drawer = page.getByRole('dialog', { name: 'Visit details' });
  await drawer.getByRole('button', { name: 'Network', exact: true }).click();
  await expect(drawer.locator('.network-address-card')).toContainText('127.0.0.1');
  await expect(drawer.getByText('Capture source', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Proxy / VPN', { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: 'Close visit details' }).click();
  mkdirSync('.data/screenshots', { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.data/screenshots/origins-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.data/screenshots/origins-mobile.png', fullPage: true });
  await visit.click();
  await drawer.getByRole('button', { name: 'Network', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.data/screenshots/network-mobile.png', fullPage: false });
  await drawer.getByRole('button', { name: 'Close visit details' }).click();
  await page.getByRole('button', { name: 'Manage IP data' }).click();
  await expect(
    page.getByRole('heading', { name: 'Location & network intelligence' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('populated origins and long IPv6 connection details stay readable and accessible', async ({
  page,
}) => {
  // Browser-only fixture: never creates synthetic traffic in the application database.
  const ip = '2606:4700:4700:1234:5678:9abc:def0:1234';
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Agent traffic' })).toBeVisible();
  expect((await page.request.post('/api/admin/run-demo')).ok()).toBe(true);
  await page.route('**/api/admin/overview*', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (!response.ok() || !data.sessions?.length) {
      await route.fulfill({ response });
      return;
    }
    data.network = {
      ...data.network,
      countryCount: 1,
      located: 1,
      asnResolved: 1,
      publicAddresses: 1,
      countries: [{ code: 'US', name: 'United States', count: 1 }],
      providers: [{ name: 'Cloudflare, Inc.', count: 1 }],
    };
    const v = data.sessions[0];
    const context = {
      ip,
      version: 6,
      scope: 'public',
      ipSource: 'integration reported',
      observedAt: v.createdAt,
      request: { httpVersion: '2.0', scheme: 'https', headers: { 'accept-language': 'en-US' } },
      enrichment: { status: 'enriched', source: 'UI test fixture' },
      location: {
        countryCode: 'US',
        country: 'United States',
        city: 'San Francisco',
        approximate: true,
      },
      asn: { number: 13335, organization: 'Cloudflare, Inc.' },
      hosting: {
        provider: 'Cloudflare network',
        kind: 'cloud / hosting / CDN',
        confidence: 'inferred',
      },
    };
    data.sessions = [{ ...v, ip, agentName: 'IPv6 interface fixture', network: context }];
    await route.fulfill({ response, json: data });
    await page.route('**/api/admin/sessions/' + v.id, async (detailRoute) => {
      const detailResponse = await detailRoute.fetch();
      const detail = await detailResponse.json();
      await detailRoute.fulfill({
        response: detailResponse,
        json: { ...detail, visit: data.sessions[0] },
      });
    });
  });
  await page.goto('/app?view=origins');
  const country = page.getByRole('button', { name: /United States/ });
  await expect(country).toBeVisible();
  await country.click();
  await expect(country).toHaveAttribute('aria-pressed', 'true');
  let results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('button', { name: 'Inspect network for IPv6 interface fixture' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.locator('.network-address-card')).toContainText(ip);
  await expect(drawer).toContainText('Cloudflare network · inferred');
  await expect(drawer).toContainText('HTTP/2.0 at host server');
  await page.setViewportSize({ width: 390, height: 844 });
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  expect(await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
