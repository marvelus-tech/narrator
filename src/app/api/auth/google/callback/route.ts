import { authFlagCookie, authHeaders, connectCookie, loginWithGoogle } from "@/server/auth";
import { getDb } from "@/server/db";
import { clearGoogleStateCookie, exchangeGoogleCode, readNamedCookie, unpackGoogleBag } from "@/server/google";
import { siteUrl } from "@/server/ids";
import { safeNextPath } from "@/shared/routes";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bag = unpackGoogleBag(readNamedCookie(req, "nr8r_google"));
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const fail = (reason: string) => {
    const headers = new Headers();
    headers.set("Location", `${siteUrl()}/login?google=${reason}`);
    headers.append("Set-Cookie", clearGoogleStateCookie());
    return new Response(null, { status: 302, headers });
  };
  if (!bag || bag.state !== state || !code) return fail("denied");
  const profile = await exchangeGoogleCode(code, bag.verifier);
  if (!profile) return fail("denied");
  try {
    const db = getDb();
    const session = loginWithGoogle(db, profile);
    const next = bag.connect ? "/app/onboarding" : safeNextPath(bag.next);
    const headers = authHeaders(session.token);
    headers.set("Location", `${siteUrl()}${next}${next.includes("?") ? "&" : "?"}autorun=1`);
    headers.append("Set-Cookie", clearGoogleStateCookie());
    if (bag.connect) headers.append("Set-Cookie", connectCookie(true));
    headers.append("Set-Cookie", authFlagCookie(true));
    return new Response(null, { status: 302, headers });
  } catch {
    return fail("denied");
  }
}
