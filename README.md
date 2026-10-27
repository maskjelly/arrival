# Arrival

Agent analytics with customizable check-in and visit timelines. Ask visitors what brought them to your website, then connect their answers to recorded activity.

- Configure questions and inspect declared objectives alongside request/browser evidence.
- Collect visits with a browser embed or server adapter.
- Try server-enforced admission, scoped access, and revocation on the demo website.
- Keep records in SQLite and export JSON or CSV.

## Run

Requires Node.js 24+.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open the [landing page](http://127.0.0.1:3000), [workspace](http://127.0.0.1:3000/app), or [protected demo](http://127.0.0.1:3000/lab). Use **Run a demo agent** to capture an actual, labeled test visit. No model API key is needed.

## Stack

React, TypeScript, Vite, Express, SQLite, and Zod. Native CSS with self-hosted fonts.

## Check

```sh
npx playwright install chromium
npm run check
```

## Status

Single-site, single-owner MVP. Agent identities are unverified; answers are self-reported. The embedded questionnaire is voluntary; enforced admission currently covers the demo site. Public-interface binding requires an owner password and should use HTTPS.

[Setup and operation](docs/development.md) · [Architecture](docs/architecture.md) · [Built and next](docs/build-status.md)
