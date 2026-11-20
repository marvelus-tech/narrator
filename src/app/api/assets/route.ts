import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { ApiError, jsonError } from "@/server/errors";
import { assertSameOrigin } from "@/server/rate";
import { assertUpload, saveAsset } from "@/server/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    const form = await req.formData();
    const projectId = String(form.get("projectId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File) || projectId.length < 8) throw new ApiError(400, "bad_upload");
    const project = db.prepare(`SELECT user_id FROM projects WHERE id = ?`).get(projectId) as { user_id: string } | undefined;
    if (!project || project.user_id !== user.id) throw new ApiError(404, "not_found");
    const bytes = Buffer.from(await file.arrayBuffer());
    assertUpload(file.type, bytes.length);
    const count = (db.prepare(`SELECT COUNT(*) AS n FROM assets WHERE project_id = ?`).get(projectId) as { n: number }).n;
    if (count >= 40) throw new ApiError(400, "bad_upload");
    const id = saveAsset(db, { userId: user.id, projectId, kind: "reference", mime: file.type, bytes });
    return Response.json({ id });
  } catch (err) {
    return jsonError(err);
  }
}
