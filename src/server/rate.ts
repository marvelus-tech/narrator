import type { Database } from "better-sqlite3";
import { ApiError } from "./errors";
import { withTx } from "./db";

// Limits are keyed by the account or the email, never by X-Forwarded-For.
// A client can forge that header. A proxy you trust still does not mint extra buckets.
export function rateIdentity(action: string, subject: string): string {
  return `${action}:${subject.trim().toLowerCase()}`;
}

export function hitRateLimit(
  db: Database,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): void {
  withTx(db, () => {
    const row = db.prepare(`SELECT window_start, count FROM rate_buckets WHERE bucket_key = ?`).get(key) as
      | { window_start: number; count: number }
      | undefined;
    if (!row || now - row.window_start >= windowMs) {
      db.prepare(
        `INSERT INTO rate_buckets (bucket_key, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT(bucket_key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
      ).run(key, now);
      return;
    }
    if (row.count >= limit) throw new ApiError(429, "rate_limited");
    db.prepare(`UPDATE rate_buckets SET count = count + 1 WHERE bucket_key = ?`).run(key);
  });
}

function expectedHost(req: Request): string {
  // Next fills request.url with its own hostname, which is localhost even when
  // the browser is on 127.0.0.1. The Host header is the origin the browser used.
  // Trust X-Forwarded-Host only when you set TRUST_PROXY behind a proxy that
  // overwrites that header. Browsers cannot set Host, so this still stops CSRF.
  const forwarded = process.env.TRUST_PROXY === "1" ? req.headers.get("x-forwarded-host") : null;
  const raw = forwarded || req.headers.get("host") || new URL(req.url).host;
  return raw.split(",")[0].trim();
}

export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) throw new ApiError(403, "origin_required");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "origin_required");
  }
  if (originHost !== expectedHost(req)) throw new ApiError(403, "origin_mismatch");
}
