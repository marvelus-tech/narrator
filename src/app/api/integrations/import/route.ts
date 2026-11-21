import { requireUser } from "@/server/auth";
import { downloadRemoteImage, isToolkit, listRemoteImages } from "@/server/composio";
import { getDb } from "@/server/db";
import { ApiError, jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { createElement, attachAsset } from "@/server/projects";
import { assertSameOrigin, hitRateLimit, rateIdentity } from "@/server/rate";
import { assertUpload, saveAsset } from "@/server/storage";

export const runtime = "nodejs";

function ownedProject(db: ReturnType<typeof getDb>, userId: string, projectId: string) {
  const project = db.prepare(`SELECT user_id FROM projects WHERE id = ?`).get(projectId) as { user_id: string } | undefined;
  if (!project || project.user_id !== userId) throw new ApiError(404, "not_found");
}

export async function GET(req: Request) {
  try {
    const db = getDb();
    const user = requireUser(db, req);
    const url = new URL(req.url);
    const toolkit = url.searchParams.get("toolkit") ?? "";
    const projectId = url.searchParams.get("projectId") ?? "";
    if ((toolkit !== "googledrive" && toolkit !== "dropbox") || projectId.length < 8) {
      return Response.json({ error: "invalid_body", message: "Choose Drive or Dropbox." }, { status: 400 });
    }
    ownedProject(db, user.id, projectId);
    const files = await listRemoteImages({ userId: user.id, toolkit });
    return Response.json({ files });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    hitRateLimit(db, rateIdentity("import", user.id), 30, 60 * 60 * 1000);
    const body = (await readJson(req)) as { toolkit?: string; projectId?: string; fileId?: string; name?: string; kind?: string };
    if (!body.toolkit || !isToolkit(body.toolkit) || (body.toolkit !== "googledrive" && body.toolkit !== "dropbox")) {
      return Response.json({ error: "invalid_body", message: "Choose Drive or Dropbox." }, { status: 400 });
    }
    if (!body.projectId || !body.fileId) return Response.json({ error: "invalid_body", message: "Choose a file." }, { status: 400 });
    ownedProject(db, user.id, body.projectId);
    const file = await downloadRemoteImage({ userId: user.id, toolkit: body.toolkit, fileId: body.fileId });
    const mime = file.mime.split(";")[0]?.trim() || "image/jpeg";
    assertUpload(mime, file.bytes.length);
    const assetId = saveAsset(db, { userId: user.id, projectId: body.projectId, kind: "reference", mime, bytes: file.bytes });
    const kind = body.kind === "location" ? "location" : "character";
    const elementId = createElement(db, user.id, {
      projectId: body.projectId,
      kind,
      name: (body.name || "Reference").slice(0, 80),
      notes: `Imported from ${body.toolkit}`,
    });
    attachAsset(db, user.id, elementId, assetId);
    return Response.json({ assetId, elementId });
  } catch (err) {
    return jsonError(err);
  }
}
