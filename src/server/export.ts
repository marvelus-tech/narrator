import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { zipSync } from "fflate";
import { ApiError } from "./errors";
import { readAssetFile, saveAsset } from "./storage";

export function exportZip(db: Database, userId: string, projectId: string): Buffer {
  const project = db.prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`).get(projectId, userId);
  if (!project) throw new ApiError(404, "not_found");
  const rows = db
    .prepare(
      `SELECT a.storage_name, a.mime, j.kind, j.id
       FROM jobs j JOIN assets a ON a.id = j.output_asset_id
       WHERE j.project_id = ? AND j.user_id = ? AND j.status = 'succeeded'
       ORDER BY j.created_at ASC`,
    )
    .all(projectId, userId) as { storage_name: string; mime: string; kind: string; id: string }[];
  if (rows.length === 0) throw new ApiError(404, "not_found");
  const files: Record<string, Uint8Array> = {};
  rows.forEach((row, index) => {
    const ext = row.storage_name.split(".").pop() || "bin";
    files[`${String(index + 1).padStart(2, "0")}-${row.kind}-${row.id.slice(0, 8)}.${ext}`] = readAssetFile(row.storage_name);
  });
  return Buffer.from(zipSync(files));
}

function ffmpegOk(): boolean {
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  return result.status === 0;
}

export function assembleCut(db: Database, userId: string, projectId: string): { assetId: string } {
  if (!ffmpegOk()) throw new ApiError(501, "render_unavailable");
  const project = db.prepare(`SELECT aspect FROM projects WHERE id = ? AND user_id = ?`).get(projectId, userId) as
    | { aspect: string }
    | undefined;
  if (!project) throw new ApiError(404, "not_found");
  const rows = db
    .prepare(
      `SELECT a.storage_name FROM jobs j
       JOIN assets a ON a.id = j.output_asset_id
       JOIN shots s ON s.id = j.shot_id
       WHERE j.project_id = ? AND j.user_id = ? AND j.kind = 'video' AND j.status = 'succeeded'
       ORDER BY s.position ASC, j.created_at ASC`,
    )
    .all(projectId, userId) as { storage_name: string }[];
  if (rows.length === 0) throw new ApiError(409, "no_clips");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "narrator-cut-"));
  try {
    const list = rows
      .map((row) => {
        const file = readAssetFile(row.storage_name);
        const target = path.join(dir, row.storage_name);
        fs.writeFileSync(target, file);
        return `file '${target.replace(/'/g, "'\\''")}'`;
      })
      .join("\n");
    const listPath = path.join(dir, "list.txt");
    const outPath = path.join(dir, "cut.mp4");
    fs.writeFileSync(listPath, list);
    const size = project.aspect === "9:16" ? "720:1280" : project.aspect === "1:1" ? "1080:1080" : "1280:720";
    const [w, h] = size.split(":");
    const result = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-an",
        "-vf",
        `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
        "-r",
        "24",
        "-pix_fmt",
        "yuv420p",
        outPath,
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) throw new ApiError(500, "render_unavailable");
    const bytes = fs.readFileSync(outPath);
    const assetId = saveAsset(db, { userId, projectId, kind: "cut", mime: "video/mp4", bytes });
    return { assetId };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
