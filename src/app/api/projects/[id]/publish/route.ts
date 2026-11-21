import { requireUser } from "@/server/auth";
import { isToolkit, publishAllowed, publishToToolkit, type Toolkit } from "@/server/composio";
import { getDb } from "@/server/db";
import { ApiError, jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { assertSameOrigin, hitRateLimit, rateIdentity } from "@/server/rate";
import { readAssetFile } from "@/server/storage";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    hitRateLimit(db, rateIdentity("publish", user.id), 30, 24 * 60 * 60 * 1000);
    const body = (await readJson(req)) as { toolkit?: string; target?: string; assetId?: string };
    const toolkit = body.toolkit || body.target || "";
    const normalized: Toolkit | null =
      toolkit === "drive" ? "googledrive" : toolkit === "social" ? "twitter" : isToolkit(toolkit) ? toolkit : null;
    if (!normalized || !body.assetId) return Response.json({ error: "invalid_body", message: "Choose a file and a destination." }, { status: 400 });
    if (user.chargeback_frozen) throw new ApiError(403, "account_frozen");
    if (!publishAllowed(user.plan, normalized)) {
      return Response.json(
        { error: "integration_plan", upgrade: true, message: "YouTube, X, and TikTok publish on Maker and Studio." },
        { status: 403 },
      );
    }
    const { id } = await context.params;
    const project = db.prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`).get(id, user.id);
    if (!project) throw new ApiError(404, "not_found");
    const asset = db.prepare(`SELECT storage_name, mime, user_id, project_id FROM assets WHERE id = ?`).get(body.assetId) as
      | { storage_name: string; mime: string; user_id: string; project_id: string | null }
      | undefined;
    if (!asset || asset.user_id !== user.id || asset.project_id !== id) throw new ApiError(404, "not_found");
    const result = await publishToToolkit({
      userId: user.id,
      toolkit: normalized,
      filename: asset.storage_name,
      mime: asset.mime,
      bytes: readAssetFile(asset.storage_name),
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
