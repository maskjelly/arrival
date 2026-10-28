# Arrival

Agent introductions and website analytics. An agent follows a normal link to your website, meets a short question step, then continues to its original destination. The customer sees declared intent alongside observed requests, country/state estimates and network ownership.

## Use

Create a customer workspace at `/start`. Install the versioned Next.js package and follow the generated setup. Manage questions, entry behavior and analytics from `/app/<workspace>`.

- Server entry for recognized interactive agents; an expiring, site-bound pass avoids repeated questions.
- Browser-reported automation can use the same introduction. Human-looking clients cannot be detected reliably.
- Native forms and URL-based submissions support different agent tools. No user-supplied test instructions are required for discovery.
- Country/state/ASN analytics and a questions → answers → continuation funnel.
- Isolated customer workspaces, password sign-in, scoped ingestion keys, JSON/CSV exports.
- Local SQLite or durable Turso storage on Vercel. IP lookup uses local DB-IP Lite datasets.

A browser snippet alone can observe visits and offer a prompt on HTML, Wix or Shopify sites; it cannot enforce HTTP questions. The Next.js server integration is the full MVP installation. Known fetch-only clients (Claude chat, ChatGPT and Perplexity fetchers) and search indexers continue without questions; their intent remains unknown unless declared, and collector outages fail open. Answers are self-reported; IPs may describe a proxy. This is not universal bot detection or a security firewall, and zero churn is not guaranteed.

## Develop

Node.js 24+:

```sh
npm ci
cp .env.example .env
npm run geo:update
npm run dev
```

Open `/` for the product, `/start` for onboarding, or `/app` for the local operator workspace. The local `/lab` demonstration remains separate from customer installations.

```sh
npx playwright install chromium
npm run check
```

React, TypeScript, Vite, Express, SQLite/Turso, Zod, Manrope and native CSS. No model key is required.

[Customer installation](packages/next/README.md) · [Architecture](docs/architecture.md) · [Vercel](docs/vercel.md) · [Network data](docs/network-data.md) · [Build status](docs/build-status.md)
