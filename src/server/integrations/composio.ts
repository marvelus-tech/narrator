import { ApiError } from "../errors";

// Publishing is optional and stays out of quote, reserve, capture, and Stripe.
// This module is the only place that talks to Composio.

export type PublishTarget = "drive" | "dropbox" | "social";

export function composioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

function toolFor(target: PublishTarget): string | null {
  if (target === "drive") return process.env.COMPOSIO_DRIVE_TOOL || null;
  if (target === "dropbox") return process.env.COMPOSIO_DROPBOX_TOOL || null;
  return process.env.COMPOSIO_SOCIAL_TOOL || null;
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
  if (input.plan !== "maker" && input.plan !== "studio") throw new ApiError(403, "integration_plan");
  const key = process.env.COMPOSIO_API_KEY;
  const tool = toolFor(input.target);
  if (!key || !tool) throw new ApiError(501, "integration_unavailable");
  const base = (process.env.COMPOSIO_BASE_URL || "https://backend.composio.dev").replace(/\/+$/, "");
  const res = await fetch(`${base}/api/v3/tools/execute/${encodeURIComponent(tool)}`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: input.userId,
      arguments: {
        filename: input.filename,
        mime: input.mime,
        file_base64: input.bytes.toString("base64"),
        text: input.target === "social" ? `Narrator export: ${input.filename}` : undefined,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new ApiError(502, "integration_unavailable");
  const json = (await res.json().catch(() => ({}))) as { id?: string; data?: { id?: string } };
  return { ok: true, id: json.id ?? json.data?.id ?? null };
}
