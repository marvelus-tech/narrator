import { TREG_ORIGIN, assertApiUrl, assertDownloadUrl } from "../hosts";
import type { GenerateInput, GenerateOutput, MediaProvider } from "./types";

// A small Treg client. One POST starts a catalog call. Async results are polled.
// Tokens and signed result URLs stay on the server and are not written to logs.

type TregReply = {
  ok: boolean;
  status: number;
  callId: string | null;
  costMicro: number | null;
  async: boolean;
  json: unknown;
  bytes: Buffer | null;
  contentType: string;
};

function baseUrl(): string {
  return TREG_ORIGIN;
}

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("provider_too_large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function parseReply(res: Response): Promise<TregReply> {
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await readCapped(res, 32_000_000);
  let json: unknown = null;
  let bytes: Buffer | null = null;
  const looksJson = /json/i.test(contentType) || (raw[0] === 0x7b && !/^(image|video|audio)\//i.test(contentType));
  if (looksJson) {
    try {
      json = JSON.parse(raw.toString("utf8"));
    } catch {
      bytes = raw;
    }
  } else if (raw.length > 0) {
    bytes = raw;
  }
  const cost = Number(res.headers.get("x-treg-cost-micro"));
  const tregError = res.headers.get("x-treg-error") === "1";
  return {
    ok: res.status >= 200 && res.status < 300 && !tregError,
    status: res.status,
    callId: res.headers.get("x-treg-call-id"),
    costMicro: res.headers.has("x-treg-cost-micro") && Number.isFinite(cost) ? cost : null,
    async: res.headers.has("x-treg-async"),
    json,
    bytes,
    contentType,
  };
}

async function tregFetch(url: string, init: RequestInit): Promise<TregReply> {
  assertApiUrl(url);
  const res = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(180_000) });
  return parseReply(res);
}

function endpointFor(kind: GenerateInput["kind"]): string {
  if (kind === "still") return process.env.TREG_STILL_ENDPOINT || "nano-banana-2";
  return process.env.TREG_VIDEO_ENDPOINT || "veo-3.1-lite";
}

function mediaFromJson(json: unknown): { url: string } | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  if (typeof record.url === "string") return { url: record.url };
  const video = record.video as { url?: string } | undefined;
  if (video?.url) return { url: video.url };
  const images = record.images as { url?: string }[] | undefined;
  if (images?.[0]?.url) return { url: images[0].url };
  const output = record.output as { url?: string } | undefined;
  if (output?.url) return { url: output.url };
  return null;
}

async function downloadUrl(url: string): Promise<{ bytes: Buffer; mime: string }> {
  assertDownloadUrl(url);
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error("provider_download");
  const bytes = await readCapped(res, 32_000_000);
  return { bytes, mime: res.headers.get("content-type") || "application/octet-stream" };
}

function pendingOutput(callId: string): GenerateOutput {
  return {
    provider: "treg",
    pending: true,
    providerRef: callId,
    bytes: null,
    mime: null,
    width: null,
    height: null,
    settledMicroUsd: null,
  };
}

async function finish(reply: TregReply, input: GenerateInput, ref: string | null): Promise<GenerateOutput> {
  let bytes = reply.bytes;
  let mime = reply.contentType || (input.kind === "video" ? "video/mp4" : "image/png");
  if (!bytes) {
    const media = mediaFromJson(reply.json);
    if (!media) throw new Error("provider_empty");
    const downloaded = await downloadUrl(media.url);
    bytes = downloaded.bytes;
    mime = downloaded.mime;
  }
  const settled = reply.costMicro ?? input.quotedMicroUsd;
  return {
    provider: "treg",
    pending: false,
    providerRef: ref,
    bytes,
    mime,
    width: null,
    height: null,
    settledMicroUsd: settled,
  };
}

export const tregProvider: MediaProvider = {
  name: "treg",
  async generate(input) {
    const token = (process.env.TREG_TOKEN || "").trim();
    if (!token) throw new Error("provider_unconfigured");
    const url = `${baseUrl()}/call/${encodeURIComponent(endpointFor(input.kind))}`;
    const maxUsd = (input.quotedMicroUsd / 1_000_000).toFixed(4);
    const reply = await tregFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Treg-Token": token,
        "Idempotency-Key": input.idempotencyKey,
        "X-Treg-Route-Max-Cost": maxUsd,
      },
      body: JSON.stringify({
        prompt: input.prompt,
        duration: input.durationSec,
        resolution: input.resolution,
      }),
    });
    if (!reply.ok) throw new Error("provider_failed");
    if (reply.async && reply.callId) return pendingOutput(reply.callId);
    return finish(reply, input, reply.callId);
  },
  async poll(ref, input) {
    const token = (process.env.TREG_TOKEN || "").trim();
    const reply = await tregFetch(`${baseUrl()}/tasks/${encodeURIComponent(ref)}`, {
      method: "GET",
      headers: { "X-Treg-Token": token },
    });
    if (!reply.ok) throw new Error("provider_failed");
    if (reply.async) {
      return {
        provider: "treg",
        pending: true,
        providerRef: ref,
        bytes: null,
        mime: null,
        width: null,
        height: null,
        settledMicroUsd: null,
      };
    }
    return finish(reply, input, ref);
  },
};
