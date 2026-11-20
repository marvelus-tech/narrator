import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { shotPatchSchema, updateShot } from "@/server/projects";
import { assertSameOrigin } from "@/server/rate";

export const runtime = "nodejs";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    const parsed = shotPatchSchema.safeParse(await readJson(req));
    if (!parsed.success) return Response.json({ error: "invalid_body", message: "Check the shot fields and try again." }, { status: 400 });
    const { id } = await context.params;
    updateShot(db, user.id, id, parsed.data);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
