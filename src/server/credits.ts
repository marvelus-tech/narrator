import type { Database } from "better-sqlite3";
import { ApiError } from "./errors";
import { withTx } from "./db";
import { newId } from "./ids";

export type BucketKind = "plan" | "pack" | "promo";

type BucketRow = {
  id: string;
  user_id: string;
  kind: BucketKind;
  granted: number;
  remaining: number;
  expires_at: number | null;
  source_id: string;
  created_at: number;
};

type AllocRow = {
  id: string;
  job_id: string;
  bucket_id: string;
  millicredits: number;
  state: "held" | "captured" | "released";
  created_at: number;
};

function ledger(
  db: Database,
  row: {
    userId: string;
    jobId?: string | null;
    bucketId?: string | null;
    kind: "grant" | "reserve" | "capture" | "refund" | "expire" | "clawback";
    millicredits: number;
    key: string;
    now: number;
    meta?: Record<string, unknown>;
  },
) {
  db.prepare(
    `INSERT INTO credit_ledger (id, user_id, job_id, bucket_id, kind, millicredits, idempotency_key, created_at, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    row.userId,
    row.jobId ?? null,
    row.bucketId ?? null,
    row.kind,
    row.millicredits,
    row.key,
    row.now,
    JSON.stringify(row.meta ?? {}),
  );
}

export function expireBuckets(db: Database, userId: string, now: number): void {
  const due = db
    .prepare(
      `SELECT id, remaining, expires_at FROM credit_buckets
       WHERE user_id = ? AND remaining > 0 AND expires_at IS NOT NULL AND expires_at <= ?`,
    )
    .all(userId, now) as { id: string; remaining: number; expires_at: number }[];
  const zero = db.prepare(`UPDATE credit_buckets SET remaining = 0 WHERE id = ? AND remaining = ?`);
  for (const row of due) {
    const changed = zero.run(row.id, row.remaining);
    if (changed.changes !== 1) continue;
    ledger(db, {
      userId,
      bucketId: row.id,
      kind: "expire",
      millicredits: -row.remaining,
      key: `expire:${row.id}:${row.expires_at}`,
      now,
    });
  }
}

export function availableMillicredits(db: Database, userId: string, now = Date.now()): number {
  return withTx(db, () => {
    expireBuckets(db, userId, now);
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(remaining), 0) AS n FROM credit_buckets
         WHERE user_id = ? AND remaining > 0 AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .get(userId, now) as { n: number };
    return row.n;
  });
}

export function listBuckets(db: Database, userId: string, now = Date.now()): BucketRow[] {
  return withTx(db, () => {
    expireBuckets(db, userId, now);
    return db
      .prepare(
        `SELECT id, user_id, kind, granted, remaining, expires_at, source_id, created_at
         FROM credit_buckets WHERE user_id = ? ORDER BY created_at ASC`,
      )
      .all(userId) as BucketRow[];
  });
}

// Caller should already be inside withTx when a job insert must share the debit.
export function grantCredits(
  db: Database,
  input: {
    userId: string;
    kind: BucketKind;
    millicredits: number;
    expiresAt: number | null;
    sourceId: string;
    now?: number;
  },
): { created: boolean; id: string } {
  return withTx(db, () => {
    const now = input.now ?? Date.now();
    const existing = db
      .prepare(`SELECT id FROM credit_buckets WHERE user_id = ? AND source_id = ?`)
      .get(input.userId, input.sourceId) as { id: string } | undefined;
    if (existing) return { created: false, id: existing.id };
    if (!Number.isSafeInteger(input.millicredits) || input.millicredits <= 0) {
      throw new ApiError(400, "invalid_body");
    }
    const id = newId();
    db.prepare(
      `INSERT INTO credit_buckets (id, user_id, kind, granted, remaining, expires_at, source_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.userId, input.kind, input.millicredits, input.millicredits, input.expiresAt, input.sourceId, now);
    ledger(db, {
      userId: input.userId,
      bucketId: id,
      kind: "grant",
      millicredits: input.millicredits,
      key: `grant:${input.sourceId}`,
      now,
      meta: { kind: input.kind, expiresAt: input.expiresAt },
    });
    return { created: true, id };
  });
}

function spendableBuckets(db: Database, userId: string, now: number): BucketRow[] {
  return db
    .prepare(
      `SELECT id, user_id, kind, granted, remaining, expires_at, source_id, created_at
       FROM credit_buckets
       WHERE user_id = ? AND remaining > 0 AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY CASE kind WHEN 'plan' THEN 0 WHEN 'promo' THEN 1 ELSE 2 END,
                CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END,
                expires_at ASC,
                created_at ASC`,
    )
    .all(userId, now) as BucketRow[];
}

// Debits plan credits first, then soonest-expiring promo, then packs.
export function reserveCredits(
  db: Database,
  input: { userId: string; jobId: string; millicredits: number; now?: number },
): void {
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(input.millicredits) || input.millicredits <= 0) {
    throw new ApiError(400, "invalid_body");
  }
  expireBuckets(db, input.userId, now);
  const buckets = spendableBuckets(db, input.userId, now);
  let left = input.millicredits;
  const takes: { id: string; take: number }[] = [];
  for (const bucket of buckets) {
    if (left <= 0) break;
    const take = Math.min(bucket.remaining, left);
    takes.push({ id: bucket.id, take });
    left -= take;
  }
  if (left > 0) throw new ApiError(402, "insufficient_credits");
  const dec = db.prepare(`UPDATE credit_buckets SET remaining = remaining - ? WHERE id = ? AND remaining >= ?`);
  for (const take of takes) {
    const changed = dec.run(take.take, take.id, take.take);
    if (changed.changes !== 1) throw new ApiError(409, "credit_race");
    const allocId = newId();
    db.prepare(
      `INSERT INTO credit_allocations (id, job_id, bucket_id, millicredits, state, created_at)
       VALUES (?, ?, ?, ?, 'held', ?)`,
    ).run(allocId, input.jobId, take.id, take.take, now);
    ledger(db, {
      userId: input.userId,
      jobId: input.jobId,
      bucketId: take.id,
      kind: "reserve",
      millicredits: -take.take,
      key: `reserve:${input.jobId}:${allocId}`,
      now,
    });
  }
}

function restoreAllocation(
  db: Database,
  userId: string,
  alloc: AllocRow,
  amount: number,
  now: number,
  reason: string,
) {
  const bucket = db.prepare(`SELECT id, expires_at, kind FROM credit_buckets WHERE id = ?`).get(alloc.bucket_id) as
    | { id: string; expires_at: number | null; kind: BucketKind }
    | undefined;
  if (!bucket) throw new ApiError(500, "internal");
  const expired = bucket.expires_at !== null && bucket.expires_at <= now;
  if (!expired) {
    db.prepare(`UPDATE credit_buckets SET remaining = remaining + ? WHERE id = ?`).run(amount, bucket.id);
    ledger(db, {
      userId,
      jobId: alloc.job_id,
      bucketId: bucket.id,
      kind: "refund",
      millicredits: amount,
      key: `refund:${alloc.id}:${amount}:${reason}`,
      now,
      meta: { reason },
    });
    return;
  }
  // The month already ended. A failed job still should not vanish, but it must not revive the whole grant.
  const sourceId = `refund:${alloc.id}:${reason}`;
  grantCredits(db, {
    userId,
    kind: "promo",
    millicredits: amount,
    expiresAt: now + 24 * 60 * 60 * 1000,
    sourceId,
    now,
  });
}

export function captureCredits(
  db: Database,
  input: { userId: string; jobId: string; actualMillicredits: number; now?: number },
): { captured: number; held: number } {
  const now = input.now ?? Date.now();
  const allocs = db
    .prepare(
      `SELECT id, job_id, bucket_id, millicredits, state, created_at
       FROM credit_allocations WHERE job_id = ? AND state = 'held' ORDER BY created_at DESC`,
    )
    .all(input.jobId) as AllocRow[];
  const held = allocs.reduce((sum, row) => sum + row.millicredits, 0);
  if (held === 0) return { captured: 0, held: 0 };
  const actual = Math.max(0, Math.min(held, input.actualMillicredits));
  let release = held - actual;
  const mark = db.prepare(`UPDATE credit_allocations SET state = ?, millicredits = ? WHERE id = ?`);
  for (const alloc of allocs) {
    if (release <= 0) {
      mark.run("captured", alloc.millicredits, alloc.id);
      continue;
    }
    if (release >= alloc.millicredits) {
      restoreAllocation(db, input.userId, alloc, alloc.millicredits, now, "settle");
      mark.run("released", alloc.millicredits, alloc.id);
      release -= alloc.millicredits;
      continue;
    }
    restoreAllocation(db, input.userId, alloc, release, now, "settle");
    mark.run("captured", alloc.millicredits - release, alloc.id);
    release = 0;
  }
  ledger(db, {
    userId: input.userId,
    jobId: input.jobId,
    kind: "capture",
    millicredits: 0,
    key: `capture:${input.jobId}`,
    now,
    meta: { captured: actual, held },
  });
  return { captured: actual, held };
}

export function refundCredits(
  db: Database,
  input: { userId: string; jobId: string; reason: string; now?: number },
): { refunded: number } {
  const now = input.now ?? Date.now();
  const allocs = db
    .prepare(
      `SELECT id, job_id, bucket_id, millicredits, state, created_at
       FROM credit_allocations WHERE job_id = ? AND state = 'held' ORDER BY created_at ASC`,
    )
    .all(input.jobId) as AllocRow[];
  let refunded = 0;
  const mark = db.prepare(`UPDATE credit_allocations SET state = 'released' WHERE id = ? AND state = 'held'`);
  for (const alloc of allocs) {
    const changed = mark.run(alloc.id);
    if (changed.changes !== 1) continue;
    restoreAllocation(db, input.userId, alloc, alloc.millicredits, now, input.reason);
    refunded += alloc.millicredits;
  }
  return { refunded };
}

export function clawbackUnspent(
  db: Database,
  input: { userId: string; sourceId: string; now?: number },
): number {
  const now = input.now ?? Date.now();
  return withTx(db, () => {
    const bucket = db
      .prepare(`SELECT id, remaining FROM credit_buckets WHERE user_id = ? AND source_id = ?`)
      .get(input.userId, input.sourceId) as { id: string; remaining: number } | undefined;
    if (!bucket || bucket.remaining <= 0) return 0;
    db.prepare(`UPDATE credit_buckets SET remaining = 0 WHERE id = ?`).run(bucket.id);
    ledger(db, {
      userId: input.userId,
      bucketId: bucket.id,
      kind: "clawback",
      millicredits: -bucket.remaining,
      key: `clawback:${input.sourceId}`,
      now,
    });
    return bucket.remaining;
  });
}
