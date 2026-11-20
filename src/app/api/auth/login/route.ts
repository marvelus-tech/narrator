import { login, sessionCookie } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { assertSameOrigin } from "@/server/rate";
import { safeNextPath } from "@/shared/routes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = (await readJson(req)) as { email?: string; password?: string; next?: string };
    const result = login(getDb(), { email: body.email ?? "", password: body.password ?? "" });
    return Response.json(
      { ok: true, next: safeNextPath(body.next) },
      { headers: { "Set-Cookie": sessionCookie(result.token) } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
