import { assertApiUrl } from "../hosts";
import type { GenerateInput, GenerateOutput, MediaProvider } from "./types";

// A bring-your-own endpoint. POST JSON, receive { mime, base64, costMicro }.
export const httpProvider: MediaProvider = {
  name: "http",
  async generate(input) {
    const url = process.env.MEDIA_HTTP_URL;
    const token = process.env.MEDIA_HTTP_TOKEN;
    if (!url || !token) throw new Error("provider_unconfigured");
    assertApiUrl(url);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: input.kind,
        prompt: input.prompt,
        resolution: input.resolution,
        durationSec: input.durationSec,
        idempotencyKey: input.idempotencyKey,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) throw new Error("provider_failed");
    const body = (await res.json()) as { mime?: string; base64?: string; costMicro?: number };
    if (!body.base64 || !body.mime) throw new Error("provider_empty");
    return {
      provider: "http",
      pending: false,
      providerRef: null,
      bytes: Buffer.from(body.base64, "base64"),
      mime: body.mime,
      width: null,
      height: null,
      settledMicroUsd: Number.isSafeInteger(body.costMicro) ? (body.costMicro as number) : input.quotedMicroUsd,
    };
  },
  async poll() {
    throw new Error("provider_failed");
  },
};
