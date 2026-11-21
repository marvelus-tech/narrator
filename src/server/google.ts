import { createHash, randomBytes } from "node:crypto";
import { GOOGLE_TOKEN_ORIGIN, GOOGLE_USERINFO_ORIGIN, assertApiUrl } from "./hosts";
import { siteUrl } from "./ids";

export type GoogleBag = { state: string; verifier: string; next: string; connect: boolean };

export function googleVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function googleChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function packGoogleBag(bag: GoogleBag): string {
  return Buffer.from(JSON.stringify(bag)).toString("base64url");
}

export function unpackGoogleBag(value: string | null): GoogleBag | null {
  if (!value) return null;
  try {
    const json = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<GoogleBag>;
    if (typeof json.state !== "string" || typeof json.verifier !== "string" || typeof json.connect !== "boolean") return null;
    if (typeof json.next !== "string" || !json.next.startsWith("/app")) return null;
    return { state: json.state, verifier: json.verifier, next: json.next, connect: json.connect };
  } catch {
    return null;
  }
}

function secure(): string {
  return siteUrl().startsWith("https:") ? "; Secure" : "";
}

export function googleStateCookie(value: string): string {
  return `nr8r_google=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure()}`;
}

export function clearGoogleStateCookie(): string {
  return `nr8r_google=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure()}`;
}

export function readNamedCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function googleRedirectUri(): string {
  return `${siteUrl()}/api/auth/google/callback`;
}

export function googleAuthorizeUrl(input: { state: string; challenge: string }): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(code: string, verifier: string): Promise<{ sub: string; email: string; emailVerified: boolean } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret || !code) return null;
  const tokenUrl = `${GOOGLE_TOKEN_ORIGIN}/token`;
  assertApiUrl(tokenUrl);
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      code_verifier: verifier,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenRes.ok) return null;
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return null;
  const infoUrl = `${GOOGLE_USERINFO_ORIGIN}/v1/userinfo`;
  assertApiUrl(infoUrl);
  const infoRes = await fetch(infoUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean };
  if (!info.sub || !info.email) return null;
  return { sub: info.sub, email: info.email, emailVerified: info.email_verified === true };
}
