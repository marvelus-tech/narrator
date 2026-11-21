import { connectCookie, verifyEmail } from "@/server/auth";
import { getDb } from "@/server/db";
import { siteUrl } from "@/server/ids";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    verifyEmail(getDb(), token);
    const connect = (req.headers.get("cookie") ?? "").includes("nr8r_connect=1");
    const dest = connect ? `${siteUrl()}/app/onboarding?verified=1` : `${siteUrl()}/app?verified=1`;
    const headers = new Headers();
    headers.set("Location", dest);
    if (connect) headers.append("Set-Cookie", connectCookie(false));
    return new Response(null, { status: 302, headers });
  } catch {
    return Response.redirect(`${siteUrl()}/login?verify=invalid`);
  }
}
