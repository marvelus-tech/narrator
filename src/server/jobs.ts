import type { Database } from "better-sqlite3";
import {
  billableSeconds,
  isPlanId,
  millicreditsForMicroUsd,
  PLANS,
  quoteStill,
  quoteVideo,
  type PlanId,
  type Resolution,
} from "@/shared/economy";
import type { UserRow } from "./auth";
import { captureCredits, refundCredits, reserveCredits } from "./credits";
import { composePrompt } from "./compose";
import { ApiError } from "./errors";
import { withTx } from "./db";
import { newId, utcDay } from "./ids";
import { selectProvider } from "./providers";
import type { GenerateInput } from "./providers/types";
import { saveAsset } from "./storage";

export type JobRow = {
  id: string;
  user_id: string;
  project_id: string;
  shot_id: string;
  kind: "still" | "video";
  status: "queued" | "running" | "succeeded" | "failed";
  resolution: string;
  duration_sec: number;
  quote_millicredits: number;
  captured_millicredits: number | null;
  provider: string;
  provider_microusd: number;
  settled_microusd: number | null;
  provider_ref: string | null;
  idempotency_key: string;
  error: string | null;
  output_asset_id: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
};

type ShotRow = {
  id: string;
  project_id: string;
  action: string;
  size: string;
  angle: string;
  movement: string;
  lens: string;
  focus: string;
  lighting: string;
  mood: string;
  duration_sec: number;
  sound_note: string;
};

function planOf(user: UserRow): PlanId {
  if (!isPlanId(user.plan)) return "free";
  return user.plan;
}

function serverBudgetMicro(): number {
  const dollars = Number(process.env.PROVIDER_DAILY_BUDGET_USD || "50");
  if (!Number.isFinite(dollars) || dollars < 0) return 50_000_000;
  return Math.round(dollars * 1_000_000);
}

function addDaily(db: Database, userId: string, day: string, micro: number) {
  db.prepare(
    `INSERT INTO daily_provider (user_id, day, microusd) VALUES (?, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET microusd = microusd + excluded.microusd`,
  ).run(userId, day, micro);
  db.prepare(
    `INSERT INTO server_daily_provider (day, microusd) VALUES (?, ?)
     ON CONFLICT(day) DO UPDATE SET microusd = microusd + excluded.microusd`,
  ).run(day, micro);
}

export function quoteForShot(kind: "still" | "video", resolution: Resolution, durationSec: number) {
  if (kind === "still") return { ...quoteStill(), seconds: 0, resolution };
  return quoteVideo(resolution, durationSec);
}

export function enqueueGeneration(
  db: Database,
  input: {
    user: UserRow;
    shotId: string;
    kind: "still" | "video";
    resolution: Resolution;
    takes: number;
    confirm: boolean;
    expectedMillicredits: number;
    requestId: string;
    now?: number;
  },
): { jobIds: string[] } {
  if (!input.confirm) throw new ApiError(400, "confirm_required");
  if (input.resolution !== "480p" && input.resolution !== "720p") throw new ApiError(400, "bad_resolution");
  if (!Number.isSafeInteger(input.takes) || input.takes < 1) throw new ApiError(400, "invalid_body");
  const now = input.now ?? Date.now();
  const plan = planOf(input.user);
  const spec = PLANS[plan];
  if (input.user.chargeback_frozen) throw new ApiError(403, "account_frozen");
  if (!input.user.email_verified_at) throw new ApiError(403, "email_unverified");
  if (input.takes > spec.takes) throw new ApiError(400, "take_limit");
  const shot = db.prepare(`SELECT * FROM shots WHERE id = ?`).get(input.shotId) as ShotRow | undefined;
  if (!shot) throw new ApiError(404, "not_found");
  const project = db.prepare(`SELECT id, user_id FROM projects WHERE id = ?`).get(shot.project_id) as
    | { id: string; user_id: string }
    | undefined;
  if (!project || project.user_id !== input.user.id) throw new ApiError(404, "not_found");
  const quote = quoteForShot(input.kind, input.resolution, shot.duration_sec);
  if (quote.millicredits !== input.expectedMillicredits) throw new ApiError(409, "price_changed");

  const keys = Array.from({ length: input.takes }, (_, take) => {
    return `${input.user.id}:${input.shotId}:${input.kind}:${input.resolution}:${input.requestId}:${take}`;
  });
  return withTx(db, () => {
    const existing = keys.map(
      (key) => db.prepare(`SELECT id FROM jobs WHERE idempotency_key = ?`).get(key) as { id: string } | undefined,
    );
    if (existing.every(Boolean)) return { jobIds: existing.map((row) => (row as { id: string }).id) };
    const freshTakes = existing.filter((row) => !row).length;
    const active = (
      db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND status IN ('queued', 'running')`).get(input.user.id) as {
        n: number;
      }
    ).n;
    if (active + freshTakes > spec.concurrency) throw new ApiError(429, "concurrency_limit");
    if (input.kind === "video" && plan === "free") {
      const dayStart = Date.parse(`${utcDay(now)}T00:00:00.000Z`);
      const videos = (
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM jobs
             WHERE user_id = ? AND kind = 'video' AND created_at >= ? AND status != 'failed'`,
          )
          .get(input.user.id, dayStart) as { n: number }
      ).n;
      if (videos + freshTakes > 1) throw new ApiError(429, "free_daily_video");
    }
    const day = utcDay(now);
    const userSpent = (
      db.prepare(`SELECT microusd FROM daily_provider WHERE user_id = ? AND day = ?`).get(input.user.id, day) as
        | { microusd: number }
        | undefined
    )?.microusd ?? 0;
    const serverSpent = (
      db.prepare(`SELECT microusd FROM server_daily_provider WHERE day = ?`).get(day) as { microusd: number } | undefined
    )?.microusd ?? 0;
    const added = quote.providerMicroUsd * freshTakes;
    if (userSpent + added > spec.dailyMicroUsd) throw new ApiError(429, "daily_ceiling");
    if (serverSpent + added > serverBudgetMicro()) throw new ApiError(503, "capacity");

    const provider = selectProvider();
    const jobIds: string[] = [];
    for (let take = 0; take < input.takes; take++) {
      const key = keys[take] as string;
      const already = existing[take];
      if (already) {
        jobIds.push(already.id);
        continue;
      }
      const jobId = newId();
      db.prepare(
        `INSERT INTO jobs (
          id, user_id, project_id, shot_id, kind, status, resolution, duration_sec,
          quote_millicredits, provider, provider_microusd, idempotency_key, created_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        jobId,
        input.user.id,
        shot.project_id,
        shot.id,
        input.kind,
        input.resolution,
        input.kind === "video" ? billableSeconds(shot.duration_sec) : 0,
        quote.millicredits,
        provider.name,
        quote.providerMicroUsd,
        key,
        now,
      );
      reserveCredits(db, { userId: input.user.id, jobId, millicredits: quote.millicredits, now });
      addDaily(db, input.user.id, day, quote.providerMicroUsd);
      jobIds.push(jobId);
    }
    return { jobIds };
  });
}

function loadPrompt(db: Database, job: JobRow): GenerateInput {
  const shot = db.prepare(`SELECT * FROM shots WHERE id = ?`).get(job.shot_id) as ShotRow;
  const project = db.prepare(`SELECT aspect, look_json FROM projects WHERE id = ?`).get(job.project_id) as {
    aspect: string;
    look_json: string;
  };
  const elements = db
    .prepare(
      `SELECT e.kind, e.name FROM elements e
       JOIN shot_elements se ON se.element_id = e.id
       WHERE se.shot_id = ?`,
    )
    .all(job.shot_id) as { kind: string; name: string }[];
  const look = JSON.parse(project.look_json) as { filmStock: string; grade: string; lensFamily: string; lighting: string };
  const prompt = composePrompt({ look, aspect: project.aspect, shot: { ...shot, durationSec: shot.duration_sec, soundNote: shot.sound_note }, elements });
  return {
    kind: job.kind,
    prompt,
    resolution: job.resolution === "720p" ? "720p" : "480p",
    durationSec: job.duration_sec || 1,
    idempotencyKey: job.idempotency_key,
    quotedMicroUsd: job.provider_microusd,
  };
}

async function settleSuccess(db: Database, job: JobRow, output: { bytes: Buffer; mime: string; width: number | null; height: number | null; settledMicroUsd: number }) {
  const settled = Math.max(0, output.settledMicroUsd);
  const actual = millicreditsForMicroUsd(Math.min(settled, job.provider_microusd));
  const now = Date.now();
  const assetId = saveAsset(db, {
    userId: job.user_id,
    projectId: job.project_id,
    kind: job.kind,
    mime: output.mime,
    bytes: output.bytes,
    width: output.width,
    height: output.height,
    now,
  });
  withTx(db, () => {
    const current = db.prepare(`SELECT status FROM jobs WHERE id = ?`).get(job.id) as { status: string };
    if (current.status === "succeeded" || current.status === "failed") return;
    const captured = captureCredits(db, { userId: job.user_id, jobId: job.id, actualMillicredits: actual, now });
    const delta = settled - job.provider_microusd;
    if (delta !== 0) addDaily(db, job.user_id, utcDay(now), delta);
    db.prepare(
      `UPDATE jobs SET status = 'succeeded', captured_millicredits = ?, settled_microusd = ?, output_asset_id = ?, finished_at = ?, error = NULL
       WHERE id = ?`,
    ).run(captured.captured, settled, assetId, now, job.id);
  });
}

function failJob(db: Database, job: JobRow, code: string) {
  const now = Date.now();
  withTx(db, () => {
    const current = db.prepare(`SELECT status FROM jobs WHERE id = ?`).get(job.id) as { status: string } | undefined;
    if (!current || current.status === "failed" || current.status === "succeeded") return;
    refundCredits(db, { userId: job.user_id, jobId: job.id, reason: code, now });
    addDaily(db, job.user_id, utcDay(job.created_at), -job.provider_microusd);
    db.prepare(`UPDATE jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?`).run(code, now, job.id);
  });
}

export async function processQueue(db: Database, limit = 3): Promise<void> {
  const now = Date.now();
  const stuck = db
    .prepare(`SELECT * FROM jobs WHERE status = 'running' AND started_at IS NOT NULL AND started_at < ? AND provider_ref IS NULL`)
    .all(now - 15 * 60 * 1000) as JobRow[];
  for (const job of stuck) failJob(db, job, "timeout");

  const queued = db
    .prepare(`SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?`)
    .all(limit) as { id: string }[];
  for (const row of queued) {
    const claimed = db.prepare(`UPDATE jobs SET status = 'running', started_at = ? WHERE id = ? AND status = 'queued'`).run(now, row.id);
    if (claimed.changes !== 1) continue;
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(row.id) as JobRow;
    try {
      const provider = selectProvider();
      const output = await provider.generate(loadPrompt(db, job));
      if (output.pending && output.providerRef) {
        db.prepare(`UPDATE jobs SET provider_ref = ?, provider = ? WHERE id = ?`).run(output.providerRef, output.provider, job.id);
        continue;
      }
      if (!output.bytes || !output.mime || output.settledMicroUsd === null) throw new Error("provider_empty");
      await settleSuccess(db, job, {
        bytes: output.bytes,
        mime: output.mime,
        width: output.width,
        height: output.height,
        settledMicroUsd: output.settledMicroUsd,
      });
    } catch {
      failJob(db, job, "provider_failed");
    }
  }

  const pending = db
    .prepare(`SELECT * FROM jobs WHERE status = 'running' AND provider_ref IS NOT NULL LIMIT ?`)
    .all(limit) as JobRow[];
  for (const job of pending) {
    if (job.started_at && now - job.started_at > 15 * 60 * 1000) {
      failJob(db, job, "timeout");
      continue;
    }
    try {
      const provider = selectProvider();
      const output = await provider.poll(job.provider_ref as string, loadPrompt(db, job));
      if (output.pending) continue;
      if (!output.bytes || !output.mime || output.settledMicroUsd === null) throw new Error("provider_empty");
      await settleSuccess(db, job, {
        bytes: output.bytes,
        mime: output.mime,
        width: output.width,
        height: output.height,
        settledMicroUsd: output.settledMicroUsd,
      });
    } catch {
      failJob(db, job, "provider_failed");
    }
  }
}

let chain: Promise<void> = Promise.resolve();

export function kickWorker(db: Database): void {
  chain = chain
    .then(() => processQueue(db))
    .catch((err) => {
      console.error("worker", err instanceof Error ? err.name : "error");
    });
}
