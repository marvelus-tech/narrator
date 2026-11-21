import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import {
  composioConfigured,
  disconnectRemote,
  isToolkit,
  listIntegrationRows,
  removeIntegration,
  syncIntegrations,
} from "@/server/composio";
import { assertSameOrigin, hitRateLimit, rateIdentity } from "@/server/rate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const db = getDb();
    const user = requireUser(db, req);
    if (composioConfigured()) {
      try {
        await syncIntegrations(db, user.id);
      } catch {
        // Keep the rows we already stored if Composio is briefly unreachable.
      }
    }
    return Response.json({
      configured: composioConfigured(),
      plan: user.plan,
      connections: listIntegrationRows(db, user.id),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    hitRateLimit(db, rateIdentity("integration", user.id), 20, 60 * 60 * 1000);
    const url = new URL(req.url);
    const body = (await readJson(req).catch(() => ({}))) as { toolkit?: string };
    const toolkit = body.toolkit || url.searchParams.get("toolkit") || "";
    if (!isToolkit(toolkit)) return Response.json({ error: "invalid_body", message: "Choose a toolkit." }, { status: 400 });
    const row = listIntegrationRows(db, user.id).find((item) => item.toolkit === toolkit);
    if (row?.connectionId) await disconnectRemote(row.connectionId);
    removeIntegration(db, user.id, toolkit);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
