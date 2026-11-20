import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { ApiError, jsonError } from "@/server/errors";
import { kickWorker } from "@/server/jobs";
import { projectPayload } from "@/server/projects";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = requireUser(db, req);
    const { id } = await context.params;
    const payload = projectPayload(db, user, id);
    if (!payload) throw new ApiError(404, "not_found");
    kickWorker(db);
    return Response.json(payload);
  } catch (err) {
    return jsonError(err);
  }
}
