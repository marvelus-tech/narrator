import { requireUser, resendVerification } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { assertSameOrigin } from "@/server/rate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    const result = await resendVerification(db, user);
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
