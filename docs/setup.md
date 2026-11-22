# Setup

Nr8tr runs as one Node process. SQLite holds accounts, the credit ledger, and jobs unless `DATABASE_URL` is set, in which case Postgres does. Media files live on disk under `ASSET_DIR`.

## Local

1. Use Node.js 22 or newer.
2. `npm install`
3. Copy `.env.example` to `.env.local`.
4. `npm run dev`
5. Optional: `npm run seed` for `demo@nr8tr.local` / `nr8tr-demo-pass`.

`NARRATOR_DEMO=1` shows the email verification link on signup and on the settings resend button. The message is also written to `data/outbox`. If `RESEND_API_KEY` is set, Nr8tr also sends through Resend. A missing mail key does not block signup.

With no provider key, Nr8tr renders a widescreen PNG and an H.264 MP4 with ffmpeg. Credits are still reserved and captured so the ledger matches a real job. `NARRATOR_PROVIDER=mock` keeps the old sample adapter for tests.

## Stripe

Create three monthly prices and three one-time prices:

- Starter, $15, `STRIPE_PRICE_STARTER`
- Maker, $29, `STRIPE_PRICE_MAKER`
- Studio, $59, `STRIPE_PRICE_STUDIO`
- 200 credits, $10, `STRIPE_PRICE_PACK_200`
- 500 credits, $25, `STRIPE_PRICE_PACK_500`
- 1,000 credits, $50, `STRIPE_PRICE_PACK_1000`

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. The price ids above are optional. When they are empty, checkout sends inline `price_data` for the same amounts. `npm run stripe:setup` can create the catalog. Point the webhook at `/api/billing/webhook` or `/api/webhooks/stripe`. Nr8tr verifies the signature and stores the Stripe event id. A repeated event does not grant credits again.

Plan credits are granted on `invoice.paid` when `billing_reason` is `subscription_create` or `subscription_cycle`. They expire at the invoice period end. Pack credits are granted on `checkout.session.completed` and do not expire. A dispute sets `chargeback_frozen` and blocks generation and publishing.

The customer portal uses the Stripe customer created on the first checkout.

Without Stripe keys, and only when demo billing is allowed, checkout calls the same grant function with a synthetic event. Demo billing is off in production unless `NARRATOR_ALLOW_DEMO_BILLING=1`. Do not set that on a public server.

## Providers

- Treg: set `NARRATOR_PROVIDER=treg`, `TREG_TOKEN`, and the still and video endpoint ids. The client posts to `/call/<endpoint>` and polls `/tasks/<id>`. The member is charged the smaller of the approved quote and the settled provider cost. A failure returns the hold.
- Your own HTTP adapter: set `NARRATOR_PROVIDER=http`, `MEDIA_HTTP_URL`, and `MEDIA_HTTP_TOKEN`. The body is JSON. The response is `{ mime, base64, costMicro }`.
- xAI or OpenAI: set `XAI_API_KEY` (Grok first) or `OPENAI_API_KEY`. Stills use the image API. Video tries the video API, then ffmpeg.
- Fal: set `FAL_KEY`.
- Neither secret: local ffmpeg stills and H.264 clips. `NARRATOR_PROVIDER=mock` is the test adapter.

Video quotes use at most 10 seconds even if the shot list says longer. 480p is the default. 720p is a separate quote. There is no 1080p price in this version.

`PROVIDER_DAILY_BUDGET_USD` caps the whole server. Each plan also has a daily ceiling. Limits are keyed by account, not by `X-Forwarded-For`.

## Publishing

Set `COMPOSIO_API_KEY`. The client is locked to `https://backend.composio.dev`. Drive and Dropbox import and export work on every plan. YouTube, X, and TikTok publish on Maker and Studio. Quote, reserve, capture, refund, and the Stripe webhook do not price those calls.

Google sign-in uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with PKCE. The server exchanges the code only at `https://oauth2.googleapis.com` and reads the profile only at `https://openidconnect.googleapis.com`.

## Production

```bash
npm run build
npm start
```

`output: "standalone"` also emits `.next/standalone` for a smaller deploy. Keep the process running so queued jobs finish. Or call `POST /api/internal/tick` with `Authorization: Bearer $JOB_TICK_SECRET`.

Set `NEXT_PUBLIC_SITE_URL` to the public origin before `npm run build` and again when the process starts. Canonical URLs, the sitemap, Stripe return links, and the session cookie all read that value. A mismatch between the build and the running process splits canonicals across hosts. The session cookie is `Secure` only when that origin is `https`. A local `http://localhost:3000` `npm start` can still log in. For GitHub Pages set `NEXT_PUBLIC_SITE_URL=https://marvelus-tech.github.io/nr8tr` so the home canonical is that URL and other pages append their path.

Set `TRUST_PROXY=1` only behind a proxy you operate. Nr8tr still does not build rate-limit buckets from `X-Forwarded-For`.

GitHub Pages: `NEXT_PUBLIC_BASE_PATH=/nr8tr NEXT_PUBLIC_SITE_URL=https://marvelus-tech.github.io/nr8tr npm run build:pages`. The static studio paints frames and records WebM in the browser. Once Pages is enabled, the live site is https://marvelus-tech.github.io/nr8tr/. Set `NEXT_PUBLIC_APP_ORIGIN` when sign-in and checkout should hit the live server.

ffmpeg is optional. Without it, silent assembly returns `render_unavailable` and zip download still works.

## Advisories

Next 15.5.29 pulls PostCSS 8.4.31. That copy matched `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-fxqj-rqcc-2cmp`, and `GHSA-r28c-9q8g-f849`. `npm audit fix` would jump Next to 16.4.6, a major upgrade, so that was not applied. `package.json` overrides `postcss` to 8.5.33, the patched 8.x release Vite already used. After the override, `npm audit` reports 0 vulnerabilities. Rebuild so the production CSS pipeline uses the same copy.

## Tests

`npm test` covers credit rounding, reserve/capture/refund, plan-before-pack spend, expiry, Stripe idempotency, signature checks, the shot workflow, free-tier video limits, route registration, and metadata length. Provider tests stay on the mock adapter.
