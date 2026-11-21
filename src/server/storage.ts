import fs from "node:fs";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { ApiError } from "./errors";
import { newId } from "./ids";
import { writableDataFile } from "./paths";

export function assetRoot(): string {
  // Assigning process.env.X = undefined stores the string "undefined".
  // Treat that as unset so files never land in a folder named undefined.
  return writableDataFile("assets", process.env.ASSET_DIR);
}

export function safeAssetPath(storageName: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(storageName)) throw new ApiError(400, "bad_upload");
  const root = assetRoot();
  const full = path.resolve(root, storageName);
  if (full !== path.join(root, storageName)) throw new ApiError(400, "bad_upload");
  return full;
}

export function writeAssetFile(storageName: string, bytes: Buffer): void {
  const full = safeAssetPath(storageName);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, bytes);
}

export function readAssetFile(storageName: string): Buffer {
  return fs.readFileSync(safeAssetPath(storageName));
}

const allowed = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
  ["video/mp4", "mp4"],
]);

export function extensionFor(mime: string): string {
  const ext = allowed.get(mime);
  if (!ext) throw new ApiError(400, "bad_upload");
  return ext;
}

export function saveAsset(
  db: Database,
  input: {
    userId: string;
    projectId: string | null;
    kind: string;
    mime: string;
    bytes: Buffer;
    width?: number | null;
    height?: number | null;
    now?: number;
  },
): string {
  const id = newId();
  const ext = extensionFor(input.mime);
  const storageName = `${id}.${ext}`;
  writeAssetFile(storageName, input.bytes);
  db.prepare(
    `INSERT INTO assets (id, user_id, project_id, kind, storage_name, mime, bytes, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.userId,
    input.projectId,
    input.kind,
    storageName,
    input.mime,
    input.bytes.length,
    input.width ?? null,
    input.height ?? null,
    input.now ?? Date.now(),
  );
  return id;
}

export const MAX_UPLOAD_BYTES = 8_000_000;

export function assertUpload(mime: string, size: number): void {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) throw new ApiError(400, "bad_upload");
  if (size <= 0 || size > MAX_UPLOAD_BYTES) throw new ApiError(400, "bad_upload");
}
