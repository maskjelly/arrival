# Development and operation

A working local MVP for understanding agent visits: ask why a visitor arrived, capture browser/request context, and connect those answers to an activity timeline.

## Run

Use Node.js 24 or newer. The local implementation was initially verified with Node 26.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:3000** for the landing page or **http://127.0.0.1:3000/app** for the workspace. The dashboard automatically creates an owner session when accessed directly from localhost. It starts with an empty database; **Run a demo agent** makes real HTTP requests through the gate and labels the resulting visit as a controlled demo.

The app stores records in `.data/arrival.sqlite`. Restarting preserves visits, questions and configuration. No external account or model key is needed.

## What works

- Owner dashboard with real counts, time series, filters and visit inspection.
- Custom short/long-answer, single-choice and multiple-choice questions, with required fields and saved schema versions.
- Protected demo at `/lab`: HTML form for browser/computer-use agents, JSON challenge for HTTP clients, one-hour server-enforced grants, revocation, search, downloads and a local shortlist action.
- Embeddable browser tracker: page views, selected browser context, scroll milestones, visibility, explicitly annotated clicks and optional questions.
- Authenticated server ingestion and an Express reporting adapter in `sdk/arrival.ts` for clients that do not execute JavaScript.
- JSON export with answers, question snapshots, evidence and events; CSV summary export.

## Try it

1. Click **Run a demo agent**. Inspect its answers and activity.
2. Open **Questions**, add your own question, and save it.
3. Open `/lab` in a new browser session to complete the live questionnaire.
4. In **Connect a website**, save your website's exact origin and copy the tracking script. Choose suspected automation, every visitor, or tracking only.
5. Generate a server ingestion key if you also want HTTP-only request data. Copy `sdk/arrival.ts` into the host service and install its reporting middleware after your session middleware.

Browser questions are voluntary and dismissible. The script does not secure the host website. The included demo uses actual server enforcement; protecting another site's content requires equivalent middleware at that site's boundary.

## HTTP check-in

Request `/lab` with `Accept: application/json`. The 403 response contains:

- `sessionToken`: credential for the pending visit.
- `questions`: the exact question snapshot to answer.
- `checkInEndpoint`: `/api/agent/check-in`.

POST `{ "sessionToken": "...", "answers": { "question_id": "answer" } }` to that endpoint. Multiple-choice answers are arrays. On success, use the **new** returned token as `Authorization: Bearer <sessionToken>` on `/lab` requests. The old token is invalidated. Browser clients receive an HttpOnly cookie instead.

Read permission is granted on admission. The default `actions` question controls search and download permissions. Its option values are `Read pages`, `Search`, and `Download files`. Changing/removing those built-in option values affects those grants; arbitrary custom question answers never grant additional permissions.

## Data and evidence

Request headers are client-controlled claims. Browser properties and task answers can be invented. The UI deliberately separates **server observed**, **request header**, **browser reported**, and **integration reported** evidence. No operator identity is cryptographically verified in this version.

Collected browser context includes user-agent, automation flag, language, timezone, platform, viewport/screen, available hardware hints, touch support and cookie capability. Request queries and referrer queries are stripped. Input contents and page text are not captured. A user's voluntarily supplied search query and questionnaire answers are recorded.

The collector can see a proxy or browser host's address rather than the end user's. It does not collect TLS fingerprints, call a geolocation service, infer private prompts or guarantee detection of computer-use agents. Browser collection requires JavaScript; server reporting is best-effort and can lose events during an outage.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

API tests cover authentication, origin checks, answer validation, snapshots, permission enforcement, expiry/revocation, persistence, replay handling, exports and real HTTP agent traversal. Browser tests exercise dashboard inspection/export, browser check-in/navigation, custom-question persistence/mobile layout and collection on a separate local origin. UI tests run the compiled production server and use a disposable `.data/ui-tests.sqlite`, never the workspace database.

## Running beyond localhost

```sh
npm run build
HOST=0.0.0.0 ADMIN_PASSWORD='choose-a-long-private-password' npm start
```

Set the password through your deployment's private environment, not client code. Public-interface binding is refused without it. Use HTTPS. If a local reverse proxy terminates TLS, configure `TRUST_PROXY=loopback`; for other topologies, configure only the actual trusted proxy addresses. Without trusted proxy configuration, forwarded headers are not accepted as authoritative.

Configuration: `PORT` (default 3000), `HOST` (default 127.0.0.1), `DATABASE_PATH`, `ADMIN_PASSWORD`, `TRUST_PROXY`.

This MVP has one site and one owner. SQLite writes are synchronous, there is no durable ingestion queue or automatic retention job, and dashboard/export queries currently return the latest 300 visits; a visit timeline returns at most 1,500 events. The all-time chart displays the latest seven days. Records beyond display limits remain in SQLite. It is not a production multi-tenant service.

See [the stack and build status](build-status.md), [the implemented architecture](architecture.md).
