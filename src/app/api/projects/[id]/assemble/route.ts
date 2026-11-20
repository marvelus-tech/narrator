import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { assembleCut } from "@/server/export";
import { assertSameOrigin } from "@/server/rate";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    const { id } = await context.params;
    const result = assembleCut(db, user.id, id);
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
