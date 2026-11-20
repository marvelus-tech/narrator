import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { ApiError, jsonError } from "@/server/errors";
import { readAssetFile } from "@/server/storage";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = requireUser(db, req);
    const { id } = await context.params;
    const asset = db.prepare(`SELECT storage_name, mime, user_id FROM assets WHERE id = ?`).get(id) as
      | { storage_name: string; mime: string; user_id: string }
      | undefined;
    if (!asset || asset.user_id !== user.id) throw new ApiError(404, "not_found");
    const bytes = readAssetFile(asset.storage_name);
    const download = new URL(req.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${asset.storage_name}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
