import { authHeaders, connectCookie, createSession, signup } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { assertSameOrigin } from "@/server/rate";
import { routes, safeNextPath } from "@/shared/routes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = (await readJson(req)) as { email?: string; password?: string; connect?: boolean; next?: string };
    const db = getDb();
    const result = await signup(db, { email: body.email ?? "", password: body.password ?? "" });
    const token = createSession(db, result.userId);
    const connect = body.connect !== false;
    const next = connect ? routes.onboarding : safeNextPath(body.next);
    const headers = authHeaders(token);
    if (connect) headers.append("Set-Cookie", connectCookie(true));
    return Response.json({ ok: true, next, devVerifyUrl: result.devVerifyUrl }, { headers });
  } catch (err) {
    return jsonError(err);
  }
}
