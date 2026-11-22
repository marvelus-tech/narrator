import type { Database } from "better-sqlite3";
import { directBrief, type DirectorPlan, type DirectorShot } from "@/shared/director";
import { PLANNER_TURN_MILLICREDITS, PLANS, type PlanId } from "@/shared/economy";
import { OPENAI_CHAT_URL, XAI_CHAT_URL, assertApiUrl } from "./hosts";
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

export type PlannedShot = DirectorShot;
export type PlannedScene = { heading: string; summary: string; shots: PlannedShot[] };

export type ShotPlan = {
  title: string;
  scenes: PlannedScene[];
  cast: DirectorPlan["cast"];
  locations: DirectorPlan["locations"];
  palette: string;
  lighting: string;
};

const HEADINGS = ["Opening", "Action", "Button", "Turn"];

function scenesFrom(shots: PlannedShot[]): PlannedScene[] {
  const scenes: PlannedScene[] = [];
  for (let i = 0; i < shots.length; i += 2) {
    const group = shots.slice(i, i + 2);
    const heading = HEADINGS[scenes.length] ?? `Scene ${scenes.length + 1}`;
    scenes.push({ heading, summary: group[0]?.action.slice(0, 140) ?? heading, shots: group });
  }
  return scenes;
}

export function planBrief(brief: string, look: Look, shotCount = 5): ShotPlan {
  const directed = directBrief(brief, shotCount);
  const shots = directed.shots.map((shot) => ({
    ...shot,
    lighting: shot.lighting || look.lighting,
    mood: shot.mood || look.grade,
  }));
  return {
    title: directed.title,
    scenes: scenesFrom(shots),
    cast: directed.cast,
    locations: directed.locations,
    palette: directed.palette,
    lighting: directed.lighting,
  };
}

function sanitizeModelPlan(raw: unknown, look: Look, brief: string, shotCount: number): ShotPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { title?: unknown; shots?: unknown; cast?: unknown; locations?: unknown; palette?: unknown; lighting?: unknown };
  if (!Array.isArray(body.shots) || body.shots.length < 4 || body.shots.length > 6) return null;
  const fallback = planBrief(brief, look, shotCount);
  const shots: PlannedShot[] = [];
  for (const item of body.shots) {
    if (!item || typeof item !== "object") return null;
    const shot = item as Partial<PlannedShot>;
    if (typeof shot.action !== "string" || shot.action.trim().length < 3) return null;
    const duration = Number(shot.durationSec ?? 5);
    const fallbackShots = fallback.scenes.flatMap((scene) => scene.shots);
    const lens = fallbackShots[shots.length]?.lens ?? "35mm Anamorphic";
    const movement = fallbackShots[shots.length]?.movement ?? "#lock-off";
    shots.push({
      action: shot.action.trim().slice(0, 500),
      size: typeof shot.size === "string" ? shot.size.slice(0, 40) : "medium",
      angle: typeof shot.angle === "string" ? shot.angle.slice(0, 40) : "eye level",
      movement: typeof shot.movement === "string" && shot.movement.startsWith("#") ? (shot.movement.slice(0, 40) as PlannedShot["movement"]) : movement,
      lens: typeof shot.lens === "string" ? (shot.lens.slice(0, 40) as PlannedShot["lens"]) : lens,
      focus: typeof shot.focus === "string" ? shot.focus.slice(0, 40) : "shallow",
      lighting: typeof shot.lighting === "string" ? shot.lighting.slice(0, 80) : look.lighting,
      mood: typeof shot.mood === "string" ? shot.mood.slice(0, 40) : look.grade,
      durationSec: Number.isFinite(duration) ? Math.min(10, Math.max(1, Math.round(duration))) : 5,
      soundNote: typeof shot.soundNote === "string" ? shot.soundNote.slice(0, 200) : "",
    });
  }
  const refs = (value: unknown, kind: string) => {
    if (!Array.isArray(value)) return kind === "cast" ? fallback.cast : fallback.locations;
    const rows = value
      .map((item) => {
        const row = item as { name?: unknown; notes?: unknown };
        if (typeof row.name !== "string" || row.name.trim().length < 2) return null;
        return { name: row.name.trim().slice(0, 80), notes: typeof row.notes === "string" ? row.notes.slice(0, 200) : "" };
      })
      .filter((row): row is { name: string; notes: string } => Boolean(row))
      .slice(0, 4);
    return rows.length > 0 ? rows : kind === "cast" ? fallback.cast : fallback.locations;
  };
  return {
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : fallback.title,
    scenes: scenesFrom(shots),
    cast: refs(body.cast, "cast"),
    locations: refs(body.locations, "location"),
    palette: typeof body.palette === "string" ? body.palette.slice(0, 40) : fallback.palette,
    lighting: typeof body.lighting === "string" ? body.lighting.slice(0, 80) : fallback.lighting,
  };
}

export function plannerConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}

const SYSTEM = [
  "You are the Nr8tr shot planner. Return one JSON object only.",
  "Fields: title, palette, lighting, cast [{name, notes}], locations [{name, notes}], shots.",
  "shots length is 4 to 6. Each shot has action, size, angle, movement, lens, focus, lighting, mood, durationSec, soundNote.",
  "lens is one of: 24mm Wide, 35mm Anamorphic, 50mm T1.4, 85mm Portrait.",
  "movement is one of: #dolly-in, #tracking, #pan-right, #crane-up, #handheld, #lock-off.",
  "durationSec is 5 or 10. Pull characters and places from the brief. Do not invent a different story.",
].join(" ");

async function chat(url: string, key: string, model: string, brief: string, look: Look, shotCount: number): Promise<unknown> {
  assertApiUrl(url);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ brief, look, shotCount }) },
      ],
    }),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("planner_http");
  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("planner_shape");
  return JSON.parse(content.slice(start, end + 1)) as unknown;
}

export async function planWithModel(
  db: Database,
  input: { userId: string; plan: PlanId; periodEnd: number | null; brief: string; look: Look; shotCount?: number; now?: number },
): Promise<ShotPlan & { charged: boolean }> {
  const shotCount = input.shotCount ?? 5;
  const fallback = () => ({ ...planBrief(input.brief, input.look, shotCount), charged: false });
  const xai = process.env.XAI_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (!xai && !openai) return fallback();
  const now = input.now ?? Date.now();
  const periodKey = input.periodEnd ? String(input.periodEnd) : "free";
  const allowance = PLANS[input.plan].plannerTurns;
  const used = db.prepare(`SELECT turns FROM planner_usage WHERE user_id = ? AND period_key = ?`).get(input.userId, periodKey) as
    | { turns: number }
    | undefined;
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
    let raw: unknown = null;
    if (xai) {
      try {
        raw = await chat(XAI_CHAT_URL, xai, process.env.XAI_MODEL || "grok-4", input.brief, input.look, shotCount);
      } catch {
        raw = null;
      }
    }
    if (!raw && openai) raw = await chat(OPENAI_CHAT_URL, openai, process.env.OPENAI_MODEL || "gpt-4o-mini", input.brief, input.look, shotCount);
    const plan = raw ? sanitizeModelPlan(raw, input.look, input.brief, shotCount) : null;
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
  } catch (err) {
    if (charge) {
      withTx(db, () => {
        refundCredits(db, { userId: input.userId, jobId, reason: "planner_failed", now });
        db.prepare(`UPDATE jobs SET status = 'failed', error = 'planner_failed', finished_at = ? WHERE id = ?`).run(now, jobId);
      });
    }
    if (err instanceof ApiError) throw err;
    return fallback();
  }
}
