import type { Database } from "better-sqlite3";
import { PLANNER_TURN_MILLICREDITS, PLANS, type PlanId } from "@/shared/economy";
import { ApiError } from "./errors";
import { captureCredits, refundCredits, reserveCredits } from "./credits";
import { withTx } from "./db";
import { newId } from "./ids";

export type Look = {
  filmStock: string;
  grade: string;
  lensFamily: string;
  lighting: string;
};

export type PlannedShot = {
  action: string;
  size: string;
  angle: string;
  movement: string;
  lens: string;
  focus: string;
  lighting: string;
  mood: string;
  durationSec: number;
  soundNote: string;
};

export type PlannedScene = {
  heading: string;
  summary: string;
  shots: PlannedShot[];
};

const SIZES = ["wide", "medium", "close", "insert", "medium", "wide"];
const ANGLES = ["eye level", "low", "eye level", "high", "eye level", "eye level"];
const MOVES = ["static", "push in", "pan", "static", "track", "static"];
const HEADINGS = ["Opening", "Action", "Button"];

export function planBrief(brief: string, look: Look): { title: string; scenes: PlannedScene[] } {
  const clean = brief.replace(/\s+/g, " ").trim();
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  const beats =
    sentences.length >= 4
      ? sentences.slice(0, 6)
      : [
          `Wide view that establishes the world of this brief: ${clean}`,
          `Introduce the main subject: ${clean}`,
          `Show the action clearly: ${clean}`,
          `Cut to a detail from the same moment: ${clean}`,
          `Show the consequence of that action: ${clean}`,
          `Hold on a closing image: ${clean}`,
        ];
  const shots: PlannedShot[] = beats.map((action, index) => ({
    action,
    size: SIZES[index % SIZES.length] ?? "medium",
    angle: ANGLES[index % ANGLES.length] ?? "eye level",
    movement: MOVES[index % MOVES.length] ?? "static",
    lens: look.lensFamily,
    focus: index % 2 === 0 ? "deep" : "shallow",
    lighting: look.lighting,
    mood: look.grade,
    durationSec: 5,
    soundNote: "",
  }));
  const scenes: PlannedScene[] = [];
  for (let i = 0; i < shots.length; i += 2) {
    const group = shots.slice(i, i + 2);
    const heading = HEADINGS[scenes.length] ?? `Scene ${scenes.length + 1}`;
    scenes.push({
      heading,
      summary: group[0]?.action.slice(0, 140) ?? heading,
      shots: group,
    });
  }
  const title = clean.split(" ").slice(0, 8).join(" ").slice(0, 80) || "Untitled brief";
  return { title, scenes };
}

type ModelShot = Partial<PlannedShot> & { action?: string };

function sanitizeModelPlan(raw: unknown, look: Look, fallbackBrief: string): { title: string; scenes: PlannedScene[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { title?: unknown; shots?: unknown };
  if (!Array.isArray(body.shots) || body.shots.length < 3 || body.shots.length > 8) return null;
  const shots: PlannedShot[] = [];
  for (const item of body.shots) {
    if (!item || typeof item !== "object") return null;
    const shot = item as ModelShot;
    if (typeof shot.action !== "string" || shot.action.trim().length < 3) return null;
    const duration = Number(shot.durationSec ?? 5);
    shots.push({
      action: shot.action.trim().slice(0, 500),
      size: typeof shot.size === "string" ? shot.size.slice(0, 40) : "medium",
      angle: typeof shot.angle === "string" ? shot.angle.slice(0, 40) : "eye level",
      movement: typeof shot.movement === "string" ? shot.movement.slice(0, 40) : "static",
      lens: typeof shot.lens === "string" ? shot.lens.slice(0, 40) : look.lensFamily,
      focus: typeof shot.focus === "string" ? shot.focus.slice(0, 40) : "shallow",
      lighting: typeof shot.lighting === "string" ? shot.lighting.slice(0, 80) : look.lighting,
      mood: typeof shot.mood === "string" ? shot.mood.slice(0, 40) : look.grade,
      durationSec: Number.isFinite(duration) ? Math.min(60, Math.max(1, Math.round(duration))) : 5,
      soundNote: typeof shot.soundNote === "string" ? shot.soundNote.slice(0, 200) : "",
    });
  }
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : planBrief(fallbackBrief, look).title;
  const scenes: PlannedScene[] = [];
  for (let i = 0; i < shots.length; i += 2) {
    const group = shots.slice(i, i + 2);
    scenes.push({
      heading: HEADINGS[scenes.length] ?? `Scene ${scenes.length + 1}`,
      summary: group[0]?.action.slice(0, 140) ?? "Scene",
      shots: group,
    });
  }
  return { title, scenes };
}

export function plannerConfigured(): boolean {
  return Boolean(process.env.PLANNER_URL && process.env.PLANNER_TOKEN);
}

// Model turns are optional. The scripted planner is the default and spends nothing.
// Included turns come from the plan. After that, one credit is reserved and captured only if the model returns a usable plan.
export async function planWithModel(
  db: Database,
  input: { userId: string; plan: PlanId; periodEnd: number | null; brief: string; look: Look; now?: number },
): Promise<{ title: string; scenes: PlannedScene[]; charged: boolean }> {
  if (!plannerConfigured()) throw new ApiError(501, "planner_unavailable");
  const now = input.now ?? Date.now();
  const periodKey = input.periodEnd ? String(input.periodEnd) : "free";
  const allowance = PLANS[input.plan].plannerTurns;
  const used = db
    .prepare(`SELECT turns FROM planner_usage WHERE user_id = ? AND period_key = ?`)
    .get(input.userId, periodKey) as { turns: number } | undefined;
  const turns = used?.turns ?? 0;
  const charge = turns >= allowance;
  const jobId = newId();
  if (charge) {
    withTx(db, () => {
      db.prepare(
        `INSERT INTO jobs (id, user_id, project_id, shot_id, kind, status, resolution, duration_sec, quote_millicredits, provider, provider_microusd, idempotency_key, created_at)
         VALUES (?, ?, 'planner', 'planner', 'still', 'running', '480p', 1, ?, 'planner', 0, ?, ?)`,
      ).run(jobId, input.userId, PLANNER_TURN_MILLICREDITS, `planner:${jobId}`, now);
      reserveCredits(db, { userId: input.userId, jobId, millicredits: PLANNER_TURN_MILLICREDITS, now });
    });
  }
  try {
    const response = await fetch(process.env.PLANNER_URL as string, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PLANNER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.PLANNER_MODEL || "planner",
        brief: input.brief,
        look: input.look,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("planner_http");
    const json: unknown = await response.json();
    const plan = sanitizeModelPlan(json, input.look, input.brief);
    if (!plan) throw new Error("planner_shape");
    withTx(db, () => {
      db.prepare(
        `INSERT INTO planner_usage (user_id, period_key, turns) VALUES (?, ?, 1)
         ON CONFLICT(user_id, period_key) DO UPDATE SET turns = turns + 1`,
      ).run(input.userId, periodKey);
      if (charge) {
        captureCredits(db, { userId: input.userId, jobId, actualMillicredits: PLANNER_TURN_MILLICREDITS, now });
        db.prepare(`UPDATE jobs SET status = 'succeeded', captured_millicredits = ?, finished_at = ? WHERE id = ?`).run(
          PLANNER_TURN_MILLICREDITS,
          now,
          jobId,
        );
      }
    });
    return { ...plan, charged: charge };
  } catch {
    if (charge) {
      withTx(db, () => {
        refundCredits(db, { userId: input.userId, jobId, reason: "planner_failed", now });
        db.prepare(`UPDATE jobs SET status = 'failed', error = 'planner_failed', finished_at = ? WHERE id = ?`).run(now, jobId);
      });
    }
    throw new ApiError(502, "planner_unavailable");
  }
}
