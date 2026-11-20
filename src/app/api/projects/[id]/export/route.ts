import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { exportZip } from "@/server/export";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = requireUser(db, req);
    const { id } = await context.params;
    const zip = exportZip(db, user.id, id);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="narrator-${id.slice(0, 8)}.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
