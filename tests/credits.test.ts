import { describe, expect, it } from "vitest";
import { availableMillicredits, captureCredits, grantCredits, refundCredits, reserveCredits } from "@/server/credits";
import { withTx } from "@/server/db";
import { newId } from "@/server/ids";
import { makeUser, tempDb } from "./helpers";

function insertJob(db: ReturnType<typeof tempDb>, userId: string, milli: number) {
  const id = newId();
  db.prepare(
    `INSERT INTO jobs (
      id, user_id, project_id, shot_id, kind, status, resolution, duration_sec, quote_millicredits, provider, provider_microusd, idempotency_key, created_at
    ) VALUES (?, ?, 'p', 's', 'still', 'queued', '480p', 0, ?, 'mock', 30000, ?, ?)`,
  ).run(id, userId, milli, id, Date.now());
  return id;
}

describe("ledger", () => {
  it("reserves, captures the smaller settled amount, and refunds a failure", () => {
    const db = tempDb();
    const user = makeUser(db);
    const now = Date.now();
    grantCredits(db, { userId: user.id, kind: "plan", millicredits: 10_000, expiresAt: now + 86_400_000, sourceId: "plan-1", now });
    grantCredits(db, { userId: user.id, kind: "pack", millicredits: 5_000, expiresAt: null, sourceId: "pack-1", now });
    const jobId = insertJob(db, user.id, 12_000);
    withTx(db, () => reserveCredits(db, { userId: user.id, jobId, millicredits: 12_000, now }));
    expect(availableMillicredits(db, user.id, now)).toBe(3_000);
    const planLeft = db.prepare(`SELECT remaining FROM credit_buckets WHERE source_id = 'plan-1'`).get() as { remaining: number };
    expect(planLeft.remaining).toBe(0);
    const captured = withTx(db, () => captureCredits(db, { userId: user.id, jobId, actualMillicredits: 8_000, now }));
    expect(captured.captured).toBe(8_000);
    expect(availableMillicredits(db, user.id, now)).toBe(7_000);

    const failed = insertJob(db, user.id, 2_000);
    withTx(db, () => reserveCredits(db, { userId: user.id, jobId: failed, millicredits: 2_000, now }));
    const refunded = withTx(db, () => refundCredits(db, { userId: user.id, jobId: failed, reason: "provider_failed", now }));
    expect(refunded.refunded).toBe(2_000);
    expect(availableMillicredits(db, user.id, now)).toBe(7_000);
  });

  it("does not spend the same grant twice and expires plan credits", () => {
    const db = tempDb();
    const user = makeUser(db);
    const now = Date.now();
    grantCredits(db, { userId: user.id, kind: "plan", millicredits: 1_000, expiresAt: now - 1, sourceId: "old", now: now - 10 });
    grantCredits(db, { userId: user.id, kind: "plan", millicredits: 1_000, expiresAt: now - 1, sourceId: "old", now: now - 10 });
    expect(availableMillicredits(db, user.id, now)).toBe(0);
    const jobId = insertJob(db, user.id, 100);
    expect(() => withTx(db, () => reserveCredits(db, { userId: user.id, jobId, millicredits: 100, now }))).toThrow(/insufficient_credits/);
  });

  it("spends plan credits before packs", () => {
    const db = tempDb();
    const user = makeUser(db);
    const now = Date.now();
    grantCredits(db, { userId: user.id, kind: "pack", millicredits: 5_000, expiresAt: null, sourceId: "pack", now: now - 10 });
    grantCredits(db, { userId: user.id, kind: "plan", millicredits: 1_000, expiresAt: now + 1000, sourceId: "plan", now });
    const jobId = insertJob(db, user.id, 1_000);
    withTx(db, () => reserveCredits(db, { userId: user.id, jobId, millicredits: 1_000, now }));
    const plan = db.prepare(`SELECT remaining FROM credit_buckets WHERE source_id = 'plan'`).get() as { remaining: number };
    const pack = db.prepare(`SELECT remaining FROM credit_buckets WHERE source_id = 'pack'`).get() as { remaining: number };
    expect(plan.remaining).toBe(0);
    expect(pack.remaining).toBe(5_000);
  });
});
