import { requireUser } from "@/server/auth";
import { isToolkit, saveIntegration } from "@/server/composio";
import { getDb } from "@/server/db";
import { siteUrl } from "@/server/ids";
import { safeNextPath } from "@/shared/routes";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const toolkit = url.searchParams.get("toolkit") ?? "";
  const next = safeNextPath(url.searchParams.get("next"));
  try {
    const db = getDb();
    const user = requireUser(db, req);
    if (isToolkit(toolkit)) {
      const connectionId = url.searchParams.get("connectedAccountId") || url.searchParams.get("connected_account_id");
      saveIntegration(db, {
        userId: user.id,
        toolkit,
        connectionId,
        status: "active",
      });
    }
  } catch {
    return Response.redirect(`${siteUrl()}/login?next=${encodeURIComponent(next)}`);
  }
  return Response.redirect(`${siteUrl()}${next}`);
}
