import type { Database } from "better-sqlite3";
import { creditsToMilli, PLANS } from "@/shared/economy";
import { ApiError } from "./errors";
import { grantCredits } from "./credits";
import { withTx } from "./db";
import { hashPassword, newId, randomToken, sha256, siteUrl, verifyPassword } from "./ids";
import { hitRateLimit, rateIdentity } from "./rate";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: number | null;
  created_at: number;
  stripe_customer_id: string | null;
  plan: string;
  plan_status: string;
  plan_period_end: number | null;
  auto_spend: number;
  chargeback_frozen: number;
  free_grant_issued: number;
};

const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const DUMMY_HASH = hashPassword("narrator-dummy-password");

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertPassword(password: string): void {
  if (password.length < 10 || password.length > 200) throw new ApiError(400, "weak_password");
}

export function getUserById(db: Database, id: string): UserRow | null {
  return (db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined) ?? null;
}

export function getUserByEmail(db: Database, email: string): UserRow | null {
  return (db.prepare(`SELECT * FROM users WHERE email = ?`).get(normalizeEmail(email)) as UserRow | undefined) ?? null;
}

export function getUserByCustomer(db: Database, customerId: string): UserRow | null {
  return (
    (db.prepare(`SELECT * FROM users WHERE stripe_customer_id = ?`).get(customerId) as UserRow | undefined) ?? null
  );
}

export function createSession(db: Database, userId: string, now = Date.now()): string {
  const token = randomToken();
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(
    sha256(token),
    userId,
    now + SESSION_MS,
    now,
  );
  return token;
}

export function userFromSession(db: Database, token: string | null, now = Date.now()): UserRow | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), now) as UserRow | undefined;
  return row ?? null;
}

export function destroySession(db: Database, token: string | null): void {
  if (!token) return;
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(sha256(token));
}

function cookieSecure(): string {
  // next start sets NODE_ENV=production even on http://localhost. A Secure cookie
  // is then dropped by the browser, so login looks successful and the next call is anonymous.
  // Tie Secure to the public origin: https sites get it, local http does not.
  return siteUrl().startsWith("https:") ? "; Secure" : "";
}

export function sessionCookie(token: string): string {
  return `narrator_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_MS / 1000)}${cookieSecure()}`;
}

export function clearSessionCookie(): string {
  return `narrator_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${cookieSecure()}`;
}

export function readSessionToken(req: Request): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "narrator_session") return rest.join("=");
  }
  return null;
}

function writeOutbox(
  db: Database,
  input: { userId: string; to: string; subject: string; body: string; now: number },
) {
  db.prepare(`INSERT INTO outbox (id, user_id, to_email, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    newId(),
    input.userId,
    input.to,
    input.subject,
    input.body,
    input.now,
  );
}

async function maybeResend(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.EMAIL_FROM || "Narrator <noreply@example.com>";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
  } catch {
    console.error("mail_failed");
  }
}

export async function signup(
  db: Database,
  input: { email: string; password: string; now?: number },
): Promise<{ userId: string; devVerifyUrl?: string }> {
  const now = input.now ?? Date.now();
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "invalid_email");
  assertPassword(input.password);
  hitRateLimit(db, rateIdentity("signup", email), 5, 60 * 60 * 1000, now);
  hitRateLimit(db, "signup:global", 30, 60 * 60 * 1000, now);
  if (getUserByEmail(db, email)) throw new ApiError(409, "email_taken");
  const userId = newId();
  const token = randomToken();
  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/verify?token=${token}`;
  const subject = "Verify your Narrator email";
  const body = `Open this link to verify your email and receive 15 credits:\n\n${verifyUrl}\n\nThe link expires in 24 hours.`;
  withTx(db, () => {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, email_verified_at, created_at, plan, plan_status, auto_spend, chargeback_frozen, free_grant_issued)
       VALUES (?, ?, ?, NULL, ?, 'free', 'none', 0, 0, 0)`,
    ).run(userId, email, hashPassword(input.password), now);
    db.prepare(`INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES (?, ?, 'verify', ?, ?)`).run(
      sha256(token),
      userId,
      now + 24 * 60 * 60 * 1000,
      now,
    );
    writeOutbox(db, { userId, to: email, subject, body, now });
  });
  await maybeResend(email, subject, body);
  return {
    userId,
    devVerifyUrl: process.env.NARRATOR_DEMO === "1" ? verifyUrl : undefined,
  };
}

export function verifyEmail(db: Database, token: string, now = Date.now()): string {
  const row = db
    .prepare(`SELECT user_id, expires_at FROM email_tokens WHERE token_hash = ? AND purpose = 'verify'`)
    .get(sha256(token)) as { user_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at <= now) throw new ApiError(400, "unverified_token");
  withTx(db, () => {
    db.prepare(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?`).run(now, row.user_id);
    db.prepare(`DELETE FROM email_tokens WHERE token_hash = ?`).run(sha256(token));
    const user = getUserById(db, row.user_id);
    if (user && user.free_grant_issued === 0) {
      grantCredits(db, {
        userId: user.id,
        kind: "promo",
        millicredits: creditsToMilli(PLANS.free.credits),
        expiresAt: null,
        sourceId: `free:${user.id}`,
        now,
      });
      db.prepare(`UPDATE users SET free_grant_issued = 1 WHERE id = ?`).run(user.id);
    }
  });
  return row.user_id;
}

export async function resendVerification(db: Database, user: UserRow, now = Date.now()) {
  if (user.email_verified_at) return { already: true as const };
  hitRateLimit(db, rateIdentity("verify", user.email), 3, 60 * 60 * 1000, now);
  const token = randomToken();
  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/verify?token=${token}`;
  const subject = "Verify your Narrator email";
  const body = `Open this link to verify your email and receive 15 credits:\n\n${verifyUrl}\n\nThe link expires in 24 hours.`;
  withTx(db, () => {
    db.prepare(`DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'verify'`).run(user.id);
    db.prepare(`INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES (?, ?, 'verify', ?, ?)`).run(
      sha256(token),
      user.id,
      now + 24 * 60 * 60 * 1000,
      now,
    );
    writeOutbox(db, { userId: user.id, to: user.email, subject, body, now });
  });
  await maybeResend(user.email, subject, body);
  return { already: false as const, devVerifyUrl: process.env.NARRATOR_DEMO === "1" ? verifyUrl : undefined };
}

export function login(
  db: Database,
  input: { email: string; password: string; now?: number },
): { token: string; user: UserRow } {
  const now = input.now ?? Date.now();
  const email = normalizeEmail(input.email);
  hitRateLimit(db, rateIdentity("login", email), 8, 15 * 60 * 1000, now);
  const user = getUserByEmail(db, email);
  const ok = verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "invalid_login");
  const token = createSession(db, user.id, now);
  return { token, user };
}

export function requireUser(db: Database, req: Request): UserRow {
  const user = userFromSession(db, readSessionToken(req));
  if (!user) throw new ApiError(401, "invalid_login");
  return user;
}
