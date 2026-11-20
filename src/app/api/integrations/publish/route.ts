import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { ApiError, jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { publishFile } from "@/server/integrations/composio";
import { assertSameOrigin, hitRateLimit, rateIdentity } from "@/server/rate";
import { readAssetFile } from "@/server/storage";

export const runtime = "nodejs";

const schema = z.object({
  assetId: z.string().min(8),
  target: z.enum(["drive", "dropbox", "social"]),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    hitRateLimit(db, rateIdentity("publish", user.id), 30, 24 * 60 * 60 * 1000);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return Response.json({ error: "invalid_body", message: "Choose a file and a destination." }, { status: 400 });
    const asset = db.prepare(`SELECT storage_name, mime, user_id FROM assets WHERE id = ?`).get(parsed.data.assetId) as
      | { storage_name: string; mime: string; user_id: string }
      | undefined;
    if (!asset || asset.user_id !== user.id) throw new ApiError(404, "not_found");
    const result = await publishFile({
      userId: user.id,
      plan: user.plan,
      frozen: user.chargeback_frozen === 1,
      target: parsed.data.target,
      filename: asset.storage_name,
      mime: asset.mime,
      bytes: readAssetFile(asset.storage_name),
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
