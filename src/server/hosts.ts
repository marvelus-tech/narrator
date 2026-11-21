// Fixed outbound hosts. Callers never pass a visitor-supplied origin.

export const XAI_ORIGIN = "https://api.x.ai";
export const OPENAI_ORIGIN = "https://api.openai.com";
export const TREG_ORIGIN = "https://api.treg.to";
export const FAL_ORIGIN = "https://fal.run";
export const COMPOSIO_ORIGIN = "https://backend.composio.dev";
export const STRIPE_ORIGIN = "https://api.stripe.com";
export const GOOGLE_TOKEN_ORIGIN = "https://oauth2.googleapis.com";
export const GOOGLE_USERINFO_ORIGIN = "https://openidconnect.googleapis.com";

export const XAI_CHAT_URL = `${XAI_ORIGIN}/v1/chat/completions`;
export const OPENAI_CHAT_URL = `${OPENAI_ORIGIN}/v1/chat/completions`;
export const XAI_IMAGE_URL = `${XAI_ORIGIN}/v1/images/generations`;
export const OPENAI_IMAGE_URL = `${OPENAI_ORIGIN}/v1/images/generations`;
export const XAI_VIDEO_URL = `${XAI_ORIGIN}/v1/videos/generations`;
export const OPENAI_VIDEO_URL = `${OPENAI_ORIGIN}/v1/videos`;

const API_HOSTS = new Set([
  "api.x.ai",
  "api.openai.com",
  "api.treg.to",
  "fal.run",
  "backend.composio.dev",
  "api.stripe.com",
  "oauth2.googleapis.com",
  "openidconnect.googleapis.com",
]);

const DOWNLOAD_HOSTS = new Set(["api.treg.to", "fal.run", "fal.media", "v3.fal.media"]);

export class HostLockedError extends Error {
  constructor() {
    super("host_locked");
    this.name = "HostLockedError";
  }
}

export function assertApiUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HostLockedError();
  }
  if (parsed.protocol !== "https:" || !API_HOSTS.has(parsed.host)) throw new HostLockedError();
  return parsed;
}

export function assertDownloadUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HostLockedError();
  }
  const host = parsed.hostname;
  const falCdn = host === "fal.media" || host.endsWith(".fal.media");
  if (parsed.protocol !== "https:" || (!DOWNLOAD_HOSTS.has(host) && !falCdn)) throw new HostLockedError();
  return parsed;
}
