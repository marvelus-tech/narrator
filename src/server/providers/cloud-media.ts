import { FAL_ORIGIN, OPENAI_IMAGE_URL, OPENAI_VIDEO_URL, XAI_IMAGE_URL, XAI_VIDEO_URL, assertApiUrl, assertDownloadUrl } from "../hosts";
import { localFilmProvider } from "./local-film";
import type { GenerateInput, GenerateOutput, MediaProvider } from "./types";

function b64From(json: unknown): { bytes: Buffer; mime: string } | null {
  const record = json as { data?: { b64_json?: string; url?: string }[]; image?: string; url?: string };
  const b64 = record.data?.[0]?.b64_json || (typeof record.image === "string" ? record.image : "");
  if (!b64) return null;
  return { bytes: Buffer.from(b64, "base64"), mime: "image/png" };
}

async function download(url: string): Promise<{ bytes: Buffer; mime: string }> {
  assertDownloadUrl(url);
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error("provider_download");
  return { bytes: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type") || "application/octet-stream" };
}

async function postJson(url: string, auth: string, body: unknown, timeoutMs: number): Promise<unknown> {
  assertApiUrl(url);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error("provider_failed");
  return res.json();
}

function output(provider: string, input: GenerateInput, file: { bytes: Buffer; mime: string }): GenerateOutput {
  return {
    provider,
    pending: false,
    providerRef: null,
    bytes: file.bytes,
    mime: file.mime,
    width: null,
    height: null,
    settledMicroUsd: input.quotedMicroUsd,
  };
}

async function fileFromJson(json: unknown): Promise<{ bytes: Buffer; mime: string }> {
  const inline = b64From(json);
  if (inline) return inline;
  const record = json as {
    data?: { url?: string }[];
    url?: string;
    images?: { url?: string }[];
    video?: { url?: string };
    output?: { url?: string };
  };
  const url = record.data?.[0]?.url || record.images?.[0]?.url || record.video?.url || record.output?.url || record.url;
  if (!url) throw new Error("provider_empty");
  return download(url);
}

async function xaiStill(input: GenerateInput): Promise<GenerateOutput> {
  const json = await postJson(
    XAI_IMAGE_URL,
    `Bearer ${process.env.XAI_API_KEY}`,
    { model: process.env.XAI_IMAGE_MODEL || "grok-2-image", prompt: input.prompt.slice(0, 2000), n: 1, response_format: "b64_json" },
    40_000,
  );
  return output("xai", input, await fileFromJson(json));
}

async function openaiStill(input: GenerateInput): Promise<GenerateOutput> {
  const json = await postJson(
    OPENAI_IMAGE_URL,
    `Bearer ${process.env.OPENAI_API_KEY}`,
    { model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", prompt: input.prompt.slice(0, 2000), size: "1536x1024" },
    40_000,
  );
  return output("openai", input, await fileFromJson(json));
}

async function falCall(model: string, body: unknown): Promise<unknown> {
  return postJson(`${FAL_ORIGIN}/${model}`, `Key ${process.env.FAL_KEY}`, body, 90_000);
}

export const falProvider: MediaProvider = {
  name: "fal",
  async generate(input) {
    const model = input.kind === "still" ? "fal-ai/flux/schnell" : "fal-ai/minimax/video-01";
    const json = await falCall(model, {
      prompt: input.prompt.slice(0, 2000),
      image_size: input.resolution === "720p" ? "landscape_16_9" : "landscape_4_3",
    });
    return output("fal", input, await fileFromJson(json));
  },
  async poll() {
    throw new Error("provider_failed");
  },
};

async function tryVideoApi(input: GenerateInput): Promise<GenerateOutput | null> {
  try {
    if (process.env.XAI_API_KEY) {
      const json = await postJson(
        XAI_VIDEO_URL,
        `Bearer ${process.env.XAI_API_KEY}`,
        { model: process.env.XAI_VIDEO_MODEL || "grok-video", prompt: input.prompt.slice(0, 2000), duration: input.durationSec },
        12_000,
      );
      return output("xai", input, await fileFromJson(json));
    }
    if (process.env.OPENAI_API_KEY) {
      const json = await postJson(
        OPENAI_VIDEO_URL,
        `Bearer ${process.env.OPENAI_API_KEY}`,
        { model: process.env.OPENAI_VIDEO_MODEL || "sora", prompt: input.prompt.slice(0, 2000), seconds: String(input.durationSec) },
        12_000,
      );
      return output("openai", input, await fileFromJson(json));
    }
  } catch {
    return null;
  }
  return null;
}

export const keyedMediaProvider: MediaProvider = {
  name: "keyed",
  async generate(input) {
    if (input.kind === "still") {
      try {
        if (process.env.XAI_API_KEY) return await xaiStill(input);
        if (process.env.OPENAI_API_KEY) return await openaiStill(input);
      } catch {
        console.error("still_fallback");
      }
    } else {
      const video = await tryVideoApi(input);
      if (video?.bytes) return video;
    }
    return localFilmProvider.generate(input);
  },
  async poll(_ref, input) {
    return localFilmProvider.poll(_ref, input);
  },
};
