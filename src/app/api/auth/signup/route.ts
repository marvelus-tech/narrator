import { signup, sessionCookie, createSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { assertSameOrigin } from "@/server/rate";
import { routes } from "@/shared/routes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = (await readJson(req)) as { email?: string; password?: string };
    const db = getDb();
    const result = await signup(db, { email: body.email ?? "", password: body.password ?? "" });
    const token = createSession(db, result.userId);
    return Response.json(
      { ok: true, next: routes.app, devVerifyUrl: result.devVerifyUrl },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
