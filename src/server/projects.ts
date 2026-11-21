import type { Database } from "better-sqlite3";
import { z } from "zod";
import type { UserRow } from "./auth";
import { availableMillicredits, listBuckets } from "./credits";
import { ApiError } from "./errors";
import { withTx } from "./db";
import { newId } from "./ids";
import { planBrief, planWithModel, plannerConfigured, type Look } from "./planner";
import { quoteStill, quoteVideo, type Resolution } from "@/shared/economy";

const lookSchema = z.object({
  filmStock: z.string().min(1).max(40),
  grade: z.string().min(1).max(40),
  lensFamily: z.string().min(1).max(40),
  lighting: z.string().min(1).max(80),
});

export const briefSchema = z.object({
  brief: z.string().trim().min(12).max(2000),
  aspect: z.enum(["2.39:1", "16:9", "9:16", "1:1"]),
  look: lookSchema,
  useModel: z.boolean().optional(),
  shotCount: z.number().int().min(4).max(6).optional(),
});

export const shotPatchSchema = z.object({
  action: z.string().trim().min(1).max(500),
  size: z.string().trim().min(1).max(40),
  angle: z.string().trim().min(1).max(40),
  movement: z.string().trim().min(1).max(40),
  lens: z.string().trim().min(1).max(40),
  focus: z.string().trim().min(1).max(40),
  lighting: z.string().trim().min(1).max(80),
  mood: z.string().trim().min(1).max(40),
  durationSec: z.number().int().min(1).max(60),
  soundNote: z.string().max(200),
});

const PROJECT_LIMIT = 30;

export async function createProject(db: Database, user: UserRow, input: z.infer<typeof briefSchema>) {
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE user_id = ?`).get(user.id) as { n: number }).n;
  if (count >= PROJECT_LIMIT) throw new ApiError(429, "project_limit");
  const planId = user.plan === "starter" || user.plan === "maker" || user.plan === "studio" ? user.plan : "free";
  const planned =
    input.useModel === false
      ? { ...planBrief(input.brief, input.look, input.shotCount ?? 5), charged: false }
      : await planWithModel(db, {
          userId: user.id,
          plan: planId,
          periodEnd: user.plan_period_end,
          brief: input.brief,
          look: input.look,
          shotCount: input.shotCount,
        });
  const now = Date.now();
  const projectId = newId();
  withTx(db, () => {
    db.prepare(
      `INSERT INTO projects (id, user_id, title, brief, aspect, look_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(projectId, user.id, planned.title, input.brief, input.aspect, JSON.stringify(input.look), now, now);
    planned.scenes.forEach((scene, sceneIndex) => {
      const sceneId = newId();
      db.prepare(`INSERT INTO scenes (id, project_id, position, heading, summary) VALUES (?, ?, ?, ?, ?)`).run(
        sceneId,
        projectId,
        sceneIndex,
        scene.heading,
        scene.summary,
      );
      scene.shots.forEach((shot, shotIndex) => {
        db.prepare(
          `INSERT INTO shots (
            id, project_id, scene_id, position, action, size, angle, movement, lens, focus, lighting, mood, duration_sec, sound_note, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          newId(),
          projectId,
          sceneId,
          sceneIndex * 2 + shotIndex,
          shot.action,
          shot.size,
          shot.angle,
          shot.movement,
          shot.lens,
          shot.focus,
          shot.lighting,
          shot.mood,
          shot.durationSec,
          shot.soundNote,
          now,
        );
      });
    });
    for (const person of planned.cast) {
      db.prepare(`INSERT INTO elements (id, project_id, kind, name, notes, created_at) VALUES (?, ?, 'character', ?, ?, ?)`).run(
        newId(),
        projectId,
        person.name.slice(0, 80),
        person.notes.slice(0, 400),
        now,
      );
    }
    for (const place of planned.locations) {
      db.prepare(`INSERT INTO elements (id, project_id, kind, name, notes, created_at) VALUES (?, ?, 'location', ?, ?, ?)`).run(
        newId(),
        projectId,
        place.name.slice(0, 80),
        place.notes.slice(0, 400),
        now,
      );
    }
  });
  return projectId;
}

export function updateShot(db: Database, userId: string, shotId: string, patch: z.infer<typeof shotPatchSchema>) {
  const shot = db.prepare(`SELECT project_id FROM shots WHERE id = ?`).get(shotId) as { project_id: string } | undefined;
  if (!shot) throw new ApiError(404, "not_found");
  const project = db.prepare(`SELECT user_id FROM projects WHERE id = ?`).get(shot.project_id) as { user_id: string } | undefined;
  if (!project || project.user_id !== userId) throw new ApiError(404, "not_found");
  const now = Date.now();
  db.prepare(
    `UPDATE shots SET action = ?, size = ?, angle = ?, movement = ?, lens = ?, focus = ?, lighting = ?, mood = ?, duration_sec = ?, sound_note = ?, updated_at = ?
     WHERE id = ?`,
  ).run(patch.action, patch.size, patch.angle, patch.movement, patch.lens, patch.focus, patch.lighting, patch.mood, patch.durationSec, patch.soundNote, now, shotId);
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now, shot.project_id);
}

export function createElement(
  db: Database,
  userId: string,
  input: { projectId: string; kind: "character" | "location" | "prop"; name: string; notes: string },
) {
  const project = db.prepare(`SELECT user_id FROM projects WHERE id = ?`).get(input.projectId) as { user_id: string } | undefined;
  if (!project || project.user_id !== userId) throw new ApiError(404, "not_found");
  const id = newId();
  db.prepare(`INSERT INTO elements (id, project_id, kind, name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id,
    input.projectId,
    input.kind,
    input.name.slice(0, 80),
    input.notes.slice(0, 400),
    Date.now(),
  );
  return id;
}

export function linkElement(db: Database, userId: string, shotId: string, elementId: string, linked: boolean) {
  const shot = db.prepare(`SELECT project_id FROM shots WHERE id = ?`).get(shotId) as { project_id: string } | undefined;
  const element = db.prepare(`SELECT project_id FROM elements WHERE id = ?`).get(elementId) as { project_id: string } | undefined;
  if (!shot || !element || shot.project_id !== element.project_id) throw new ApiError(404, "not_found");
  const project = db.prepare(`SELECT user_id FROM projects WHERE id = ?`).get(shot.project_id) as { user_id: string };
  if (project.user_id !== userId) throw new ApiError(404, "not_found");
  if (linked) {
    db.prepare(`INSERT INTO shot_elements (shot_id, element_id) VALUES (?, ?) ON CONFLICT DO NOTHING`).run(shotId, elementId);
  } else {
    db.prepare(`DELETE FROM shot_elements WHERE shot_id = ? AND element_id = ?`).run(shotId, elementId);
  }
}

export function attachAsset(db: Database, userId: string, elementId: string, assetId: string) {
  const element = db.prepare(`SELECT project_id FROM elements WHERE id = ?`).get(elementId) as { project_id: string } | undefined;
  const asset = db.prepare(`SELECT user_id, project_id FROM assets WHERE id = ?`).get(assetId) as
    | { user_id: string; project_id: string | null }
    | undefined;
  if (!element || !asset || asset.user_id !== userId) throw new ApiError(404, "not_found");
  const project = db.prepare(`SELECT user_id FROM projects WHERE id = ?`).get(element.project_id) as { user_id: string };
  if (project.user_id !== userId || asset.project_id !== element.project_id) throw new ApiError(404, "not_found");
  const count = (
    db.prepare(`SELECT COUNT(*) AS n FROM element_assets WHERE element_id = ?`).get(elementId) as { n: number }
  ).n;
  if (count >= 8) throw new ApiError(400, "too_many_refs");
  db.prepare(`INSERT INTO element_assets (element_id, asset_id) VALUES (?, ?) ON CONFLICT DO NOTHING`).run(elementId, assetId);
}

export function projectPayload(db: Database, user: UserRow, projectId: string) {
  const project = db.prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`).get(projectId, user.id) as
    | {
        id: string;
        title: string;
        brief: string;
        aspect: string;
        look_json: string;
        updated_at: number;
      }
    | undefined;
  if (!project) return null;
  const scenes = db
    .prepare(`SELECT id, position, heading, summary FROM scenes WHERE project_id = ? ORDER BY position ASC`)
    .all(projectId) as { id: string; position: number; heading: string; summary: string }[];
  const shots = db.prepare(`SELECT * FROM shots WHERE project_id = ? ORDER BY position ASC`).all(projectId) as {
    id: string;
    scene_id: string;
    position: number;
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
  }[];
  const links = db
    .prepare(
      `SELECT se.shot_id, se.element_id FROM shot_elements se
       JOIN shots s ON s.id = se.shot_id WHERE s.project_id = ?`,
    )
    .all(projectId) as { shot_id: string; element_id: string }[];
  const elements = db.prepare(`SELECT id, kind, name, notes FROM elements WHERE project_id = ? ORDER BY created_at ASC`).all(projectId) as {
    id: string;
    kind: string;
    name: string;
    notes: string;
  }[];
  const elementAssets = db
    .prepare(
      `SELECT ea.element_id, ea.asset_id FROM element_assets ea
       JOIN elements e ON e.id = ea.element_id WHERE e.project_id = ?`,
    )
    .all(projectId) as { element_id: string; asset_id: string }[];
  const assets = db
    .prepare(`SELECT id, kind, mime, bytes, width, height FROM assets WHERE project_id = ? ORDER BY created_at DESC`)
    .all(projectId) as { id: string; kind: string; mime: string; bytes: number; width: number | null; height: number | null }[];
  const jobs = db
    .prepare(
      `SELECT id, shot_id, kind, status, resolution, quote_millicredits, captured_millicredits, error, output_asset_id, created_at
       FROM jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT 80`,
    )
    .all(projectId) as {
    id: string;
    shot_id: string;
    kind: string;
    status: string;
    resolution: string;
    quote_millicredits: number;
    captured_millicredits: number | null;
    error: string | null;
    output_asset_id: string | null;
    created_at: number;
  }[];
  const look = JSON.parse(project.look_json) as Look;
  return {
    project: { id: project.id, title: project.title, brief: project.brief, aspect: project.aspect, look, updatedAt: project.updated_at },
    scenes: scenes.map((scene) => ({
      ...scene,
      shots: shots
        .filter((shot) => shot.scene_id === scene.id)
        .map((shot) => ({
          id: shot.id,
          position: shot.position,
          action: shot.action,
          size: shot.size,
          angle: shot.angle,
          movement: shot.movement,
          lens: shot.lens,
          focus: shot.focus,
          lighting: shot.lighting,
          mood: shot.mood,
          durationSec: shot.duration_sec,
          soundNote: shot.sound_note,
          elementIds: links.filter((link) => link.shot_id === shot.id).map((link) => link.element_id),
          quotes: {
            still: quoteStill().millicredits,
            video480: quoteVideo("480p" satisfies Resolution, shot.duration_sec).millicredits,
            video720: quoteVideo("720p", shot.duration_sec).millicredits,
          },
        })),
    })),
    elements: elements.map((element) => ({
      ...element,
      assetIds: elementAssets.filter((row) => row.element_id === element.id).map((row) => row.asset_id),
    })),
    assets,
    jobs,
    balance: {
      millicredits: availableMillicredits(db, user.id),
      buckets: listBuckets(db, user.id).map((bucket) => ({
        id: bucket.id,
        kind: bucket.kind,
        remaining: bucket.remaining,
        granted: bucket.granted,
        expiresAt: bucket.expires_at,
      })),
    },
    plan: user.plan,
    plannerConfigured: plannerConfigured(),
    integrations: {
      configured: Boolean(process.env.COMPOSIO_API_KEY),
      canPublish: user.plan === "maker" || user.plan === "studio",
    },
  };
}

export function listProjects(db: Database, userId: string) {
  return db
    .prepare(
      `SELECT p.id, p.title, p.brief, p.updated_at,
        (SELECT COUNT(*) FROM shots s WHERE s.project_id = p.id) AS shots,
        (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id AND j.status = 'succeeded') AS outputs
       FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`,
    )
    .all(userId) as { id: string; title: string; brief: string; updated_at: number; shots: number; outputs: number }[];
}
