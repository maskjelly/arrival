# Install Arrival

Arrival observes visits without restricting website access. Check-in is optional. No CAPTCHA, redirect or access token is required to browse your website.

## Start here

1. Run Arrival on a reachable HTTPS address and set `PUBLIC_URL` to that address so generated snippets use it even when the workspace is opened locally. Localhost works only for local websites; a temporary tunnel is useful for testing, not permanent installation.
2. Open **Connect a website** in the workspace. Save the site's origin, such as `https://www.example.com`. Scheme, hostname and port must match the live site. Saving a URL with a path normalizes it to its origin.
3. Choose **Any website**, **Wix**, **Shopify**, or **Next.js**. Copy the generated snippet and publish it once site-wide.
4. Visit the published site, then click **Check installation**. This checks actual collection from the configured origin, not whether the snippet merely exists.

The script and site ID are public. Never put the server ingestion key in HTML or a `NEXT_PUBLIC_` variable.

## Any HTML website

Replace the two placeholders with your Arrival HTTPS address and site ID. The workspace fills these in for you.

```html
<link
  rel="alternate"
  type="application/json"
  title="Optional agent check-in"
  href="https://YOUR-ARRIVAL/api/agent/manifest/YOUR-SITE-ID"
/>
<script
  defer
  src="https://YOUR-ARRIVAL/tracker.js"
  data-site="YOUR-SITE-ID"
  data-check-in="agents"
></script>
```

Paste into the shared head or your platform's site-wide custom-code field. The link makes the reporting contract discoverable in the original HTML, including for HTTP agents that do not execute scripts. It is an Arrival convention, not a universally supported agent standard.

`data-check-in` accepts `agents` (default: a collapsed prompt for suspected automation), `all` (same prompt for everyone), and `off` (activity only). It never opens a modal, takes focus or hides the website. **Skip** is remembered for the tab, and answers are not requested again after submission. Tokens survive reloads and full-page navigation in the tab; history navigation records new pathnames without duplicating the script. Query strings are discarded.

## Wix

In your published site's dashboard, open **Settings → Custom Code → Add Custom Code**. Paste the HTML snippet. Choose **Head**, **All pages**, and load once per visit. Apply it, then visit the published domain. Use the site's analytics consent category and existing consent manager.

Use the Custom Code feature, rather than an iframe HTML element. Wix requires a published site with a connected domain for this feature; plan availability can vary. [Wix's instructions](https://support.wix.com/en/article/adding-a-custom-code-snippet-for-tracking-tools-analytics).

## Shopify

In **Online Store → Themes**, duplicate the theme, then open **Edit code** on the copy. Open `layout/theme.liquid`, paste the HTML snippet before `</head>`, preview it, and publish the theme. [Shopify's theme-code instructions](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/edit-code/edit-theme-code).

This integration covers the theme storefront. Checkout, customer accounts, headless storefronts and Shopify Web Pixels use separate surfaces. This repository does not include a Shopify marketplace app or consent bridge. Load Arrival through the store's existing consent setup. When changing themes, add the snippet to the new theme.

## Next.js browser tracking

Use the workspace's **Next.js** snippet in your existing `app/layout.tsx`. Keep your layout's existing `<html>`, `<head>`, `<body>`, children and providers; merge the elements into them.

```tsx
import Script from 'next/script';

// Inside the existing head:
<link rel="alternate" type="application/json"
  title="Optional agent check-in"
  href="https://YOUR-ARRIVAL/api/agent/manifest/YOUR-SITE-ID" />

// Inside the existing body, after children:
<Script id="arrival" strategy="afterInteractive"
  src="https://YOUR-ARRIVAL/tracker.js"
  data-site="YOUR-SITE-ID" data-check-in="agents" />
```

For the Pages Router, put `Script` in `pages/_app.tsx` and the link in `next/head`. The script observes `pushState`, `replaceState` and `popstate` pathname changes. No per-page tracking component is needed. [Next.js Script documentation](https://nextjs.org/docs/app/api-reference/components/script).

## HTTP agents and non-JavaScript crawlers

A browser script cannot automatically observe a request if the client never executes it. On any platform, cooperative HTTP agents can read the manifest linked in your HTML and voluntarily report their task. An agent with only read-only fetch tools can continue browsing without answering.

The manifest contains current questions, endpoint URLs and executable request shapes:

1. `GET /api/agent/manifest/YOUR-SITE-ID`.
2. `POST` its `collectionEndpoint` with `{"type":"start","path":"/docs"}`.
3. Keep the returned `sessionToken` and questionnaire snapshot. Use `Authorization: Bearer TOKEN` for subsequent reports.
4. Optionally POST `{"type":"check_in","path":"/docs","answers":{"question_id":"answer"}}` to the same endpoint. Multiple-choice answers are arrays. Required fields apply only when choosing to submit.
5. Reuse the token with `type: "start"` to report another page in the same visit, or send an event with a UUID as documented in the manifest.

These are **agent-reported declarations**. They are not proof that the agent actually fetched those pages. The public manifest and endpoint are an Arrival protocol; agents must choose to use them. Existing agent tools do not automatically support every website's questionnaire.

For automatic HTTP request evidence, add a server helper or integrate server/CDN logs. On hosted Wix and Shopify, a custom-code snippet cannot access their underlying HTTP logs. A native app/log connector is not implemented here.

### Express: one middleware, no session package

Copy `sdk/arrival.ts` into the host service. Generate the ingestion key in Arrival and keep it in `ARRIVAL_INGEST_KEY` on the host server.

```ts
import { arrivalAnalytics } from './lib/arrival';

app.use(
  arrivalAnalytics({
    endpoint: process.env.ARRIVAL_URL!,
    key: process.env.ARRIVAL_INGEST_KEY!,
  }),
);
```

Install before your routes. It creates an opaque `arrival_sid` cookie, reports after the response finishes, and adds a manifest Link header. A custom `sessionId(req)` can reuse an existing session system. Report errors and even a failing `onError` hook do not change the host response. It is best-effort, with a three-second reporting timeout and no durable retry queue.

### Next.js: optional server collection

Copy `sdk/web.ts` to `lib/web.ts`. The workspace generates the complete proxy example, including the session cookie and discovery header. Use `proxy.ts` alongside `app/` in Next.js 16+, or the existing `middleware.ts` convention for older versions. Merge into an existing proxy rather than creating a competing one.

```ts
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { reportArrival } from './lib/web';

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const incoming = request.cookies.get('arrival_sid')?.value;
  const sessionId =
    incoming && /^[a-zA-Z0-9_-]{20,120}$/.test(incoming) ? incoming : crypto.randomUUID();
  const response = NextResponse.next();
  if (sessionId !== incoming)
    response.cookies.set('arrival_sid', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 86400,
    });
  response.headers.append(
    'Link',
    '<https://YOUR-ARRIVAL/api/agent/manifest/YOUR-SITE-ID>; rel="alternate"; type="application/json"',
  );
  event.waitUntil(
    reportArrival(request, {
      endpoint: process.env.ARRIVAL_URL!,
      key: process.env.ARRIVAL_INGEST_KEY,
      sessionId,
    }).then(() => {}),
  );
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\.).*)'],
};
```

This records arrival at the proxy, not the final application's response status. The helper leaves that status unknown; a handler reporting after an actual response can pass `status`. Keep reporting alive with the host's `waitUntil` mechanism, rather than awaiting it before returning website content. [Next.js Proxy and waitUntil](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

Browser and server helpers currently produce separate visit records. Automatic cross-channel merging is not implemented; neither session ID is a verified identity.

## Custom actions and programmatic answers

```html
<button data-arrival-track="Compare plans">Compare plans</button>
```

After the script is ready, browser agents or your own code can use:

```js
await window.arrival.ready;
await window.arrival.identify({ objective: 'Compare API pricing' }); // Include configured required answers.
await window.arrival.track('Compared plans');
await window.arrival.checkIn(); // Open the optional form explicitly.
window.arrival.disable(); // Stop future sends on this page; does not delete earlier records.
```

There are no automatic form-input, page-text or private-prompt captures. Follow the host website's analytics consent rules; Arrival does not replace its consent manager. A restrictive CSP needs the Arrival origin in `script-src` and `connect-src`, and the prompt's inline styles must be permitted. Use `data-check-in="off"` if styles cannot be allowed.

## Deployment and limits

The Arrival collector itself must be hosted separately with HTTPS, owner authentication, persistent SQLite storage and backups. This is a self-hosted single-site MVP, not an already-operated multi-tenant SaaS. Native Wix/Shopify apps, complete CDN log connectors, durable delivery and automatic retention are still to build. The platform steps were checked against official documentation; authenticated installs on actual Wix or Shopify stores have not been tested in this workspace.
