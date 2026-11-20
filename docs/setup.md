# Setup

Narrator runs as one Node process. SQLite holds accounts, the credit ledger, and jobs. Media files live on disk under `ASSET_DIR`.

## Local

1. Use Node.js 22 or newer.
2. `npm install`
3. Copy `.env.example` to `.env.local`.
4. `npm run dev`
5. Optional: `npm run seed` for `demo@narrator.local` / `narrator-demo-pass`.

`NARRATOR_DEMO=1` shows the email verification link on signup and on the settings resend button. The message is also written to `data/outbox`. If `RESEND_API_KEY` is set, Narrator also sends through Resend. A missing mail key does not block signup.

`NARRATOR_PROVIDER=mock` (or a missing provider token) generates a small SVG still and a one-second sample MP4. Credits are still reserved and captured so the ledger matches a real job. No outside provider is billed.

## Stripe

Create three monthly prices and three one-time prices:

- Starter, $15, `STRIPE_PRICE_STARTER`
- Maker, $29, `STRIPE_PRICE_MAKER`
- Studio, $59, `STRIPE_PRICE_STUDIO`
- 200 credits, $10, `STRIPE_PRICE_PACK_200`
- 500 credits, $25, `STRIPE_PRICE_PACK_500`
- 1,000 credits, $50, `STRIPE_PRICE_PACK_1000`

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Point the webhook at `/api/billing/webhook`. Narrator verifies the signature and stores the Stripe event id. A repeated event does not grant credits again.

Plan credits are granted on `invoice.paid` when `billing_reason` is `subscription_create` or `subscription_cycle`. They expire at the invoice period end. Pack credits are granted on `checkout.session.completed` and do not expire. A dispute sets `chargeback_frozen` and blocks generation and publishing.

The customer portal uses the Stripe customer created on the first checkout.

Without Stripe keys, and only when demo billing is allowed, checkout calls the same grant function with a synthetic event. Demo billing is off in production unless `NARRATOR_ALLOW_DEMO_BILLING=1`. Do not set that on a public server.

## Providers

- Treg: set `NARRATOR_PROVIDER=treg`, `TREG_TOKEN`, and the still and video endpoint ids. The client posts to `/call/<endpoint>` and polls `/tasks/<id>`. The member is charged the smaller of the approved quote and the settled provider cost. A failure returns the hold.
- Your own HTTP adapter: set `NARRATOR_PROVIDER=http`, `MEDIA_HTTP_URL`, and `MEDIA_HTTP_TOKEN`. The body is JSON. The response is `{ mime, base64, costMicro }`.
- Neither secret: mock mode.

Video quotes use at most 10 seconds even if the shot list says longer. 480p is the default. 720p is a separate quote. There is no 1080p price in this version.

`PROVIDER_DAILY_BUDGET_USD` caps the whole server. Each plan also has a daily ceiling. Limits are keyed by account, not by `X-Forwarded-For`.

## Publishing

Set `COMPOSIO_API_KEY` and the tool slugs for Drive, Dropbox, and social. Only Maker and Studio can call them, and only from the publish route. Quote, reserve, capture, refund, and the Stripe webhook do not import that module.

## Production

```bash
npm run build
npm start
```

`output: "standalone"` also emits `.next/standalone` for a smaller deploy. Keep the process running so queued jobs finish. Or call `POST /api/internal/tick` with `Authorization: Bearer $JOB_TICK_SECRET`.

Set `NEXT_PUBLIC_SITE_URL` to the public origin before `npm run build` and again when the process starts. Canonical URLs, the sitemap, Stripe return links, and the session cookie all read that value. A mismatch between the build and the running process splits canonicals across hosts. The session cookie is `Secure` only when that origin is `https`. A local `http://localhost:3000` `npm start` can still log in.

Set `TRUST_PROXY=1` only behind a proxy you operate. Narrator still does not build rate-limit buckets from `X-Forwarded-For`.

ffmpeg is optional. Without it, silent assembly returns `render_unavailable` and zip download still works.

## Advisories

Next 15.5.29 pulls PostCSS 8.4.31. That copy matched `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-fxqj-rqcc-2cmp`, and `GHSA-r28c-9q8g-f849`. `npm audit fix` would jump Next to 16.4.6, a major upgrade, so that was not applied. `package.json` overrides `postcss` to 8.5.33, the patched 8.x release Vite already used. After the override, `npm audit` reports 0 vulnerabilities. Rebuild so the production CSS pipeline uses the same copy.

## Tests

`npm test` covers credit rounding, reserve/capture/refund, plan-before-pack spend, expiry, Stripe idempotency, signature checks, the shot workflow, free-tier video limits, route registration, and metadata length. Provider tests stay on the mock adapter.
