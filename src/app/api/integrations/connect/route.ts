import { requireUser } from "@/server/auth";
import { isToolkit, saveIntegration, startToolkitConnect } from "@/server/composio";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { siteUrl } from "@/server/ids";
import { assertSameOrigin, hitRateLimit, rateIdentity } from "@/server/rate";
import { safeNextPath } from "@/shared/routes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    hitRateLimit(db, rateIdentity("integration", user.id), 20, 60 * 60 * 1000);
    const body = (await readJson(req)) as { toolkit?: string; next?: string };
    if (!body.toolkit || !isToolkit(body.toolkit)) {
      return Response.json({ error: "invalid_body", message: "Choose a toolkit." }, { status: 400 });
    }
    const next = safeNextPath(body.next);
    const callback = `${siteUrl()}/api/integrations/callback?toolkit=${encodeURIComponent(body.toolkit)}&next=${encodeURIComponent(next)}`;
    const result = await startToolkitConnect({ userId: user.id, toolkit: body.toolkit, callbackUrl: callback });
    if (result.connectionId) {
      saveIntegration(db, { userId: user.id, toolkit: body.toolkit, connectionId: result.connectionId, status: "pending" });
    }
    if (result.status === "setup") {
      return Response.json({
        status: "setup",
        redirectUrl: null,
        message: "Add COMPOSIO_API_KEY to connect this toolkit. The studio still runs without it.",
      });
    }
    return Response.json({ status: "redirect", redirectUrl: result.redirectUrl });
  } catch (err) {
    return jsonError(err);
  }
}
