import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { migrate, openDatabase } from "@/server/db";
import { hashPassword, newId } from "@/server/ids";
import type { UserRow } from "@/server/auth";

export function tempDb(): Database.Database {
  const db = openDatabase(":memory:");
  migrate(db);
  return db;
}

export function tempFileDb(): { db: Database.Database; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "narrator-"));
  const file = path.join(dir, "test.sqlite");
  const db = openDatabase(file);
  migrate(db);
  return { db, file };
}

export function makeUser(db: Database.Database, overrides: Partial<UserRow> = {}): UserRow {
  const now = Date.now();
  const user: UserRow = {
    id: overrides.id ?? newId(),
    email: overrides.email ?? `${newId()}@example.com`,
    password_hash: overrides.password_hash ?? hashPassword("narrator-demo-pass"),
    email_verified_at: overrides.email_verified_at === undefined ? now : overrides.email_verified_at,
    created_at: overrides.created_at ?? now - 48 * 60 * 60 * 1000,
    stripe_customer_id: overrides.stripe_customer_id ?? null,
    plan: overrides.plan ?? "free",
    plan_status: overrides.plan_status ?? "none",
    plan_period_end: overrides.plan_period_end ?? null,
    auto_spend: overrides.auto_spend ?? 0,
    chargeback_frozen: overrides.chargeback_frozen ?? 0,
    free_grant_issued: overrides.free_grant_issued ?? 1,
  };
  db.prepare(
    `INSERT INTO users (
      id, email, password_hash, email_verified_at, created_at, stripe_customer_id, plan, plan_status, plan_period_end, auto_spend, chargeback_frozen, free_grant_issued
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.email,
    user.password_hash,
    user.email_verified_at,
    user.created_at,
    user.stripe_customer_id,
    user.plan,
    user.plan_status,
    user.plan_period_end,
    user.auto_spend,
    user.chargeback_frozen,
    user.free_grant_issued,
  );
  return user;
}
