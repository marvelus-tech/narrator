import { verifyEmail } from "@/server/auth";
import { getDb } from "@/server/db";
import { siteUrl } from "@/server/ids";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    verifyEmail(getDb(), token);
    return Response.redirect(`${siteUrl()}/app?verified=1`);
  } catch {
    return Response.redirect(`${siteUrl()}/login?verify=invalid`);
  }
}
