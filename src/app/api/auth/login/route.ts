import { authHeaders, connectCookie, login } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { assertSameOrigin } from "@/server/rate";
import { routes, safeNextPath } from "@/shared/routes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = (await readJson(req)) as { email?: string; password?: string; next?: string; connect?: boolean };
    const result = login(getDb(), { email: body.email ?? "", password: body.password ?? "" });
    const connect = body.connect === true;
    const next = connect ? routes.onboarding : safeNextPath(body.next);
    const headers = authHeaders(result.token);
    if (connect) headers.append("Set-Cookie", connectCookie(true));
    return Response.json({ ok: true, next }, { headers });
  } catch (err) {
    return jsonError(err);
  }
}
