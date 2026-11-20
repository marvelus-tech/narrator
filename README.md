# Narrator

Narrator turns one film brief into an editable shot list, then prices each still and clip before a credit moves.

A credit has a face value of $0.05. Quotes use a 1.25 markup on the provider cost and round up to 0.1 credit. Monthly plan credits expire at the end of the paid period. Pack credits do not expire. Failed jobs return the hold. A finished file you dislike stays charged.

This is a new product. It keeps the useful ideas from an MIT film desk (a shot plan, a credit hold, a provider adapter, a local sample mode) and does not copy that project's interface or branding.

## What you can do

- Read the landing page, pricing, how it works, terms, privacy, and refunds.
- Create an account, verify email, and receive 15 credits once.
- Turn a brief into scenes and shots, edit them, and attach up to eight reference images per element.
- Approve a still, a 480p draft, or a 720p finish. Jobs run in the background.
- Download a file, a zip, or a silent cut when `ffmpeg` is installed.
- Subscribe to Starter ($15 / 240), Maker ($29 / 500), or Studio ($59 / 1090), buy packs, and open the Stripe customer portal.
- Optionally publish to Drive, Dropbox, or social through Composio on Maker and Studio. That path does not price a generation.

Mock mode is the default. Missing provider, Stripe, email, and Composio secrets do not block local use.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

```bash
npm run seed
```

Seed writes a local Maker account, `demo@narrator.local` / `narrator-demo-pass`, with plan credits that expire in 30 days and one sample project. Do not run seed against a production database.

In demo mode the signup response includes the verification link. The same link is stored in `data/outbox`. Production does not return that link unless `NARRATOR_DEMO=1`.

Demo checkout (no Stripe key) grants credits through the same ledger as a webhook. It is refused when `NODE_ENV=production` unless `NARRATOR_ALLOW_DEMO_BILLING=1`. Leave that flag unset on any public server.

More detail is in [docs/setup.md](docs/setup.md).

## Scripts

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The app is a Next.js server with one SQLite file. Run it as a long-lived Node process (`next start` or the standalone server). A separate cron can `POST /api/internal/tick` with `Authorization: Bearer $JOB_TICK_SECRET`.

## Plans

| Plan | Price | Credits | Jobs at once | Takes per click | Daily provider ceiling |
| --- | --- | --- | --- | --- | --- |
| Free | $0 | 15 once | 1 | 1 | $1 |
| Starter | $15 | 240 | 2 | 1 | $8 |
| Maker | $29 | 500 | 4 | 2 | $20 |
| Studio | $59 | 1090 | 8 | 4 | $40 |

Packs: 200 for $10, 500 for $25, 1,000 for $50. Packs need a paid plan. The 1,000 credit pack is locked for the first 24 hours.

Example quotes at face value: a still is 0.8 credits ($0.04), a 5 second 480p clip is 12.9 credits ($0.645), a 5 second 720p clip is 33.8 credits ($1.69).

## Not in this version

- No promise of a finished film with dialogue, music, and a picture cut.
- No blanket commercial-use license. Rights follow the provider.
- No bring-your-own provider key billing.
- Speech and music are not mixed into the cut. The optional assembly is silent.
- No auto-refill and no yearly price.
