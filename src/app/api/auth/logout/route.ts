import { clearAuthHeaders, destroySession, readSessionToken } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { assertSameOrigin } from "@/server/rate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    destroySession(getDb(), readSessionToken(req));
    return Response.json({ ok: true }, { headers: clearAuthHeaders() });
  } catch (err) {
    return jsonError(err);
  }
}
