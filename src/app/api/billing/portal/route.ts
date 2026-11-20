import { requireUser } from "@/server/auth";
import { startPortal } from "@/server/billing";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { assertSameOrigin } from "@/server/rate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = requireUser(getDb(), req);
    const url = await startPortal(user);
    return Response.json({ url });
  } catch (err) {
    return jsonError(err);
  }
}
