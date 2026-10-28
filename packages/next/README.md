# Arrival for Next.js

Use the same integration for any customer website. The setup screen supplies your workspace's collector URL, site ID and private key. No per-customer application endpoints or copied reporting helpers are needed.

## Install

```sh
npm install https://github.com/maskjelly/arrival/releases/download/sdk-v0.2.0/arrival-next-0.2.0.tgz
```

Set these in your host's environment and redeploy:

```dotenv
NEXT_PUBLIC_ARRIVAL_URL=https://arrival-iota.vercel.app
NEXT_PUBLIC_ARRIVAL_SITE_ID=YOUR_SITE_ID
ARRIVAL_INGEST_KEY=YOUR_PRIVATE_SERVER_KEY
```

The ingestion key must never be public or included in browser code.

Create `middleware.ts`:

```ts
export { middleware } from '@arrival/next';
export const config = {
  matcher: [
    '/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:css|js|png|jpg|jpeg|gif|svg|woff2?)$).*)',
  ],
};
```

If your project already has middleware, call Arrival before returning your existing response; honor an introduction response before serving content. Next.js 16 projects use the equivalent `proxy.ts` convention.

In the existing root layout, add the component inside `<body>`:

```tsx
import { Arrival } from '@arrival/next/client';

// Keep existing layout, metadata and providers.
<body>
  {children}
  <Arrival />
</body>;
```

The component loads the public browser tracker before hydration. Browser-reported automation requests the same server introduction; ordinary browsers are observed without a redirect. An introduced browser does not receive a second optional questionnaire. Sites with a strict CSP must allow the collector script and its connection origin.

## Behavior

- Recognized interactive agent: a readable HTTP 200 introduction at the requested URL. The requested content is withheld until valid answers yield a pass.
- Answer: POST the form, or use the described GET submission when the tool can only open URLs. Only short task context belongs in URL answers; POST is preferred because URL queries can enter host logs.
- Continue: HTTP 303 to the original path/query. Cookies retain clearance for one hour; stateless tools can reuse `__arrival_pass` on this website.
- Detection: user-agent patterns and a cooperative browser automation signal. Names are not verified. A spoofed human browser can evade detection.
- Search indexers: observe without questions by default. This is a deliberate coverage boundary.
- Unknown visitors: observe; do not claim they are human.
- Collector unavailable: fail open to preserve website availability. This is an observability product, not an authorization boundary for private content.
- API routes and static application assets are excluded by the sample matcher. Documents such as PDF/text remain covered. Add a suitable server integration for API-only resources.

`/.well-known/arrival.json` is handled by the middleware and returns workspace discovery. Link headers advertise it. Robots.txt remains crawler guidance, not access control; the package does not replace a customer's robots file.

Settings and question changes apply through a short policy cache. Existing introductions retain their question snapshot. New users use the same `/start` → install → private dashboard flow as Whiteye.
