import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function newId(): string {
  return randomBytes(16).toString("hex");
}

export function nowMs(): number {
  return Date.now();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function utcDay(now = nowMs()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function demoMode(): boolean {
  return process.env.NARRATOR_DEMO === "1";
}

// Demo purchases call the same grant function as Stripe. They stay off when
// Node is in production unless an operator sets the extra flag on purpose.
export function demoBillingAllowed(): boolean {
  if (!demoMode()) return false;
  if (process.env.NODE_ENV === "production" && process.env.NARRATOR_ALLOW_DEMO_BILLING !== "1") return false;
  return true;
}
