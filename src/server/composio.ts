import type { Database } from "better-sqlite3";
import { ApiError } from "./errors";
import { COMPOSIO_ORIGIN, assertApiUrl, assertDownloadUrl } from "./hosts";

function assertBrowserRedirect(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError(502, "integration_unavailable");
  }
  const host = parsed.hostname;
  const composio = host === "composio.dev" || host.endsWith(".composio.dev");
  const oauth =
    host === "accounts.google.com" ||
    host === "www.dropbox.com" ||
    host === "twitter.com" ||
    host === "x.com" ||
    host === "www.tiktok.com" ||
    host === "tiktok.com";
  if (parsed.protocol !== "https:" || (!composio && !oauth)) throw new ApiError(502, "integration_unavailable");
}

// Composio stays off the quote, reserve, capture, and Stripe paths.
// Every request uses the fixed host https://backend.composio.dev.

export const TOOLKITS = ["googledrive", "dropbox", "youtube", "twitter", "tiktok"] as const;
export type Toolkit = (typeof TOOLKITS)[number];

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const LABELS: Record<Toolkit, string> = {
  googledrive: "Google Drive",
  dropbox: "Dropbox",
  youtube: "YouTube",
  twitter: "X",
  tiktok: "TikTok",
};

const UPLOAD_TOOL: Record<Toolkit, string> = {
  googledrive: "GOOGLEDRIVE_UPLOAD_FILE",
  dropbox: "DROPBOX_UPLOAD_FILE",
  youtube: "YOUTUBE_UPLOAD_VIDEO",
  twitter: "TWITTER_CREATION_OF_A_POST",
  tiktok: "TIKTOK_UPLOAD_VIDEO",
};

const LIST_TOOL: Record<Toolkit, string> = {
  googledrive: "GOOGLEDRIVE_FIND_FILE",
  dropbox: "DROPBOX_LIST_FILES",
  youtube: "GOOGLEDRIVE_FIND_FILE",
  twitter: "GOOGLEDRIVE_FIND_FILE",
  tiktok: "GOOGLEDRIVE_FIND_FILE",
};

export function isToolkit(value: string): value is Toolkit {
  return (TOOLKITS as readonly string[]).includes(value);
}

export function toolkitLabel(toolkit: Toolkit): string {
  return LABELS[toolkit];
}

export function socialToolkit(toolkit: Toolkit): boolean {
  return toolkit === "youtube" || toolkit === "twitter" || toolkit === "tiktok";
}

export function publishAllowed(plan: string, toolkit: Toolkit): boolean {
  if (!socialToolkit(toolkit)) return true;
  return plan === "maker" || plan === "studio";
}

export function composioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY?.trim());
}

function apiKey(): string {
  return process.env.COMPOSIO_API_KEY?.trim() ?? "";
}

async function composio(path: string, init: RequestInit, fetchImpl: FetchLike, key: string): Promise<Response> {
  const url = `${COMPOSIO_ORIGIN}${path}`;
  assertApiUrl(url);
  return fetchImpl(url, {
    ...init,
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
}

export type ConnectResult = {
  status: "redirect" | "setup";
  redirectUrl: string | null;
  connectionId: string | null;
};

export async function startToolkitConnect(input: {
  userId: string;
  toolkit: Toolkit;
  callbackUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
}): Promise<ConnectResult> {
  const key = input.apiKey ?? apiKey();
  if (!key) return { status: "setup", redirectUrl: null, connectionId: null };
  const fetchImpl = input.fetchImpl ?? fetch;
  let authConfigId = "";
  const listed = await composio(
    `/api/v3/auth_configs?toolkit_slug=${encodeURIComponent(input.toolkit)}`,
    { method: "GET" },
    fetchImpl,
    key,
  );
  if (listed.ok) {
    const body = (await listed.json()) as { items?: { id?: string }[]; data?: { id?: string }[] };
    authConfigId = body.items?.[0]?.id || body.data?.[0]?.id || "";
  }
  if (!authConfigId) {
    const created = await composio(
      "/api/v3/auth_configs",
      {
        method: "POST",
        body: JSON.stringify({
          toolkit: { slug: input.toolkit },
          type: "use_composio_managed_auth",
        }),
      },
      fetchImpl,
      key,
    );
    if (created.ok) {
      const body = (await created.json()) as { id?: string; auth_config?: { id?: string } };
      authConfigId = body.id || body.auth_config?.id || "";
    }
  }
  if (!authConfigId) throw new ApiError(502, "integration_unavailable");
  const linked = await composio(
    "/api/v3/connected_accounts/link",
    {
      method: "POST",
      body: JSON.stringify({
        auth_config_id: authConfigId,
        user_id: input.userId,
        callback_url: input.callbackUrl,
      }),
    },
    fetchImpl,
    key,
  );
  if (!linked.ok) {
    const fallback = await composio(
      "/api/v3/connected_accounts",
      {
        method: "POST",
        body: JSON.stringify({
          auth_config: { id: authConfigId },
          connection: { user_id: input.userId, callback_url: input.callbackUrl },
        }),
      },
      fetchImpl,
      key,
    );
    if (!fallback.ok) throw new ApiError(502, "integration_unavailable");
    const body = (await fallback.json()) as { redirect_url?: string; redirectUrl?: string; id?: string };
    const redirectUrl = body.redirect_url || body.redirectUrl || null;
    if (!redirectUrl) throw new ApiError(502, "integration_unavailable");
    assertBrowserRedirect(redirectUrl);
    return { status: "redirect", redirectUrl, connectionId: body.id ?? null };
  }
  const body = (await linked.json()) as { redirect_url?: string; redirectUrl?: string; connected_account_id?: string; id?: string };
  const redirectUrl = body.redirect_url || body.redirectUrl || null;
  if (!redirectUrl) throw new ApiError(502, "integration_unavailable");
  assertBrowserRedirect(redirectUrl);
  return { status: "redirect", redirectUrl, connectionId: body.connected_account_id || body.id || null };
}

export function listIntegrationRows(db: Database, userId: string) {
  const rows = db
    .prepare(`SELECT toolkit, connection_id, status, connected_at FROM user_integrations WHERE user_id = ?`)
    .all(userId) as { toolkit: string; connection_id: string | null; status: string; connected_at: number }[];
  const byToolkit = new Map(rows.map((row) => [row.toolkit, row]));
  return TOOLKITS.map((toolkit) => {
    const row = byToolkit.get(toolkit);
    return {
      toolkit,
      label: LABELS[toolkit],
      status: row?.status ?? "disconnected",
      connectionId: row?.connection_id ?? null,
      connectedAt: row?.connected_at ?? null,
      social: socialToolkit(toolkit),
    };
  });
}

export function saveIntegration(
  db: Database,
  input: { userId: string; toolkit: Toolkit; connectionId: string | null; status: string; now?: number },
) {
  const now = input.now ?? Date.now();
  db.prepare(
    `INSERT INTO user_integrations (user_id, toolkit, connection_id, status, connected_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, toolkit) DO UPDATE SET connection_id = excluded.connection_id, status = excluded.status, connected_at = excluded.connected_at`,
  ).run(input.userId, input.toolkit, input.connectionId, input.status, now);
}

export function removeIntegration(db: Database, userId: string, toolkit: Toolkit) {
  db.prepare(`DELETE FROM user_integrations WHERE user_id = ? AND toolkit = ?`).run(userId, toolkit);
}

export async function syncIntegrations(db: Database, userId: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const key = apiKey();
  if (!key) return;
  const res = await composio(
    `/api/v3/connected_accounts?user_ids=${encodeURIComponent(userId)}`,
    { method: "GET" },
    fetchImpl,
    key,
  );
  if (!res.ok) return;
  const body = (await res.json()) as { items?: { id?: string; status?: string; toolkit?: { slug?: string } }[] };
  for (const item of body.items ?? []) {
    const slug = item.toolkit?.slug ?? "";
    if (!isToolkit(slug)) continue;
    const status = (item.status ?? "").toUpperCase() === "ACTIVE" ? "active" : "pending";
    saveIntegration(db, { userId, toolkit: slug, connectionId: item.id ?? null, status });
  }
}

export async function disconnectRemote(connectionId: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const key = apiKey();
  if (!key || !connectionId) return;
  await composio(`/api/v3/connected_accounts/${encodeURIComponent(connectionId)}`, { method: "DELETE" }, fetchImpl, key);
}

type RemoteFile = { id: string; name: string; mime: string };

function filesFrom(json: unknown): RemoteFile[] {
  const root = json as { data?: unknown; items?: unknown; files?: unknown };
  const list = [root?.data, root?.items, root?.files, json].find(Array.isArray) as Record<string, unknown>[] | undefined;
  if (!list) return [];
  const files: RemoteFile[] = [];
  for (const item of list) {
    const id = String(item.id ?? item.file_id ?? item.path ?? "");
    const name = String(item.name ?? item.title ?? item.path_display ?? "reference");
    const mime = String(item.mimeType ?? item.mime_type ?? item.mime ?? "image/jpeg");
    if (!id || id.length > 300) continue;
    if (!mime.startsWith("image/")) continue;
    files.push({ id: id.slice(0, 300), name: name.slice(0, 120), mime: mime.slice(0, 80) });
    if (files.length >= 12) break;
  }
  return files;
}

export async function listRemoteImages(input: {
  userId: string;
  toolkit: "googledrive" | "dropbox";
  fetchImpl?: FetchLike;
}): Promise<RemoteFile[]> {
  const key = apiKey();
  if (!key) return [];
  const fetchImpl = input.fetchImpl ?? fetch;
  const tool = input.toolkit === "dropbox" ? LIST_TOOL.dropbox : LIST_TOOL.googledrive;
  const arguments_ =
    input.toolkit === "dropbox"
      ? { path: "" }
      : { q: "mimeType contains 'image/'", pageSize: 12 };
  const res = await composio(
    `/api/v3/tools/execute/${encodeURIComponent(tool)}`,
    { method: "POST", body: JSON.stringify({ user_id: input.userId, arguments: arguments_ }) },
    fetchImpl,
    key,
  );
  if (!res.ok) throw new ApiError(502, "integration_unavailable");
  const json = await res.json();
  return filesFrom(json);
}

async function bytesFromTool(json: unknown, fetchImpl: FetchLike): Promise<{ bytes: Buffer; mime: string } | null> {
  const record = json as {
    data?: { file_base64?: string; base64?: string; url?: string; mime?: string; mimetype?: string };
    file_base64?: string;
    url?: string;
  };
  const data = record.data ?? {};
  const b64 = data.file_base64 || data.base64 || record.file_base64;
  const mime = data.mime || data.mimetype || "image/jpeg";
  if (typeof b64 === "string" && b64.length > 0) {
    return { bytes: Buffer.from(b64, "base64"), mime };
  }
  const url = data.url || record.url;
  if (typeof url !== "string") return null;
  assertDownloadUrl(url);
  const res = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, mime: res.headers.get("content-type") || mime };
}

export async function downloadRemoteImage(input: {
  userId: string;
  toolkit: "googledrive" | "dropbox";
  fileId: string;
  fetchImpl?: FetchLike;
}): Promise<{ bytes: Buffer; mime: string }> {
  const key = apiKey();
  if (!key) throw new ApiError(501, "integration_unavailable");
  if (!/^[A-Za-z0-9_.:/=-]{1,300}$/.test(input.fileId)) throw new ApiError(400, "bad_upload");
  const fetchImpl = input.fetchImpl ?? fetch;
  const tool = input.toolkit === "dropbox" ? "DROPBOX_DOWNLOAD_FILE" : "GOOGLEDRIVE_DOWNLOAD_FILE";
  const res = await composio(
    `/api/v3/tools/execute/${encodeURIComponent(tool)}`,
    {
      method: "POST",
      body: JSON.stringify({
        user_id: input.userId,
        arguments: { file_id: input.fileId, path: input.fileId },
      }),
    },
    fetchImpl,
    key,
  );
  if (!res.ok) throw new ApiError(502, "integration_unavailable");
  const file = await bytesFromTool(await res.json(), fetchImpl);
  if (!file || file.bytes.length === 0 || file.bytes.length > 8_000_000) throw new ApiError(400, "bad_upload");
  return file;
}

export async function publishToToolkit(input: {
  userId: string;
  toolkit: Toolkit;
  filename: string;
  mime: string;
  bytes: Buffer;
  fetchImpl?: FetchLike;
}): Promise<{ ok: true; id: string | null }> {
  const key = apiKey();
  if (!key) throw new ApiError(501, "integration_unavailable");
  if (input.bytes.length > 20_000_000) throw new ApiError(400, "bad_upload");
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await composio(
    `/api/v3/tools/execute/${encodeURIComponent(UPLOAD_TOOL[input.toolkit])}`,
    {
      method: "POST",
      body: JSON.stringify({
        user_id: input.userId,
        arguments: {
          filename: input.filename.slice(0, 120),
          mime: input.mime,
          file_base64: input.bytes.toString("base64"),
          text: `Nr8tr export: ${input.filename.slice(0, 80)}`,
        },
      }),
    },
    fetchImpl,
    key,
  );
  if (!res.ok) throw new ApiError(502, "integration_unavailable");
  const json = (await res.json().catch(() => ({}))) as { id?: string; data?: { id?: string } };
  return { ok: true, id: json.id ?? json.data?.id ?? null };
}

export type PublishTarget = "drive" | "dropbox" | "social";

export function targetToolkit(target: PublishTarget): Toolkit {
  if (target === "drive") return "googledrive";
  if (target === "dropbox") return "dropbox";
  return "twitter";
}

export async function publishFile(input: {
  userId: string;
  plan: string;
  frozen: boolean;
  target: PublishTarget;
  filename: string;
  mime: string;
  bytes: Buffer;
}): Promise<{ ok: true; id: string | null }> {
  if (input.frozen) throw new ApiError(403, "account_frozen");
  const toolkit = targetToolkit(input.target);
  if (!publishAllowed(input.plan, toolkit)) throw new ApiError(403, "integration_plan");
  return publishToToolkit({
    userId: input.userId,
    toolkit,
    filename: input.filename,
    mime: input.mime,
    bytes: input.bytes,
  });
}
