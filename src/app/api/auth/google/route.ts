import { getDb } from "@/server/db";
import { googleAuthorizeUrl, googleChallenge, googleStateCookie, googleVerifier, packGoogleBag } from "@/server/google";
import { siteUrl } from "@/server/ids";
import { hitRateLimit } from "@/server/rate";
import { safeNextPath } from "@/shared/routes";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const connect = url.searchParams.get("connect") !== "0";
  const next = connect ? "/app/onboarding" : safeNextPath(url.searchParams.get("next"));
  if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    return Response.redirect(`${siteUrl()}/login?google=setup`);
  }
  try {
    hitRateLimit(getDb(), "google:start", 40, 60 * 60 * 1000);
  } catch {
    return Response.redirect(`${siteUrl()}/login?google=rate`);
  }
  const state = googleVerifier();
  const verifier = googleVerifier();
  const headers = new Headers();
  headers.set("Location", googleAuthorizeUrl({ state, challenge: googleChallenge(verifier) }));
  headers.append("Set-Cookie", googleStateCookie(packGoogleBag({ state, verifier, next, connect })));
  return new Response(null, { status: 302, headers });
}
