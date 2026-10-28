# Arrival

Agent observability without getting in the way. Collect visit activity and optional task summaries while your website stays open.

- Configure questions and inspect declared objectives alongside request/browser evidence.
- Collect visits with a browser embed or server adapter.
- Inspect exit IPs, approximate locations, ASN ownership and inferred hosting networks with local lookups.
- Paste a snippet into any HTML site, Wix, Shopify or Next.js; no client package or private key.
- Offer a small nonmodal prompt and a structured reporting protocol for HTTP agents.
- Keep records in SQLite and export JSON or CSV.

## Run

Requires Node.js 24+.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open the [landing page](http://127.0.0.1:3000), [workspace](http://127.0.0.1:3000/app), or [open demo](http://127.0.0.1:3000/lab). Use **Run a demo agent** to capture an actual, labeled test visit. No model API key is needed.

Enable location and ASN lookup in **Connect a website**, or run `npm run geo:update` before starting. Visitor IPs stay local during lookup. [Network data and accuracy](docs/network-data.md).

## Stack

React, TypeScript, Vite, Express, SQLite, Zod, and local DB-IP Lite databases. Native CSS with self-hosted fonts.

Vercel deployments use durable Turso storage. [Deployment and phone-agent testing](docs/vercel.md).

## Check

```sh
npx playwright install chromium
npm run check
```

## Status

Single-site, single-owner MVP. Questions are optional and collection never blocks your website. Agent identities are unverified; answers are self-reported. Automatic HTTP-only request logging requires a server/log integration; a browser snippet alone cannot see it. A reachable HTTPS collector is needed for external sites.

[Install on your website](docs/integrations.md) · [Setup and operation](docs/development.md) · [Architecture](docs/architecture.md) · [Built and next](docs/build-status.md)
