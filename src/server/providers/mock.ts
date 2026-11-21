import { billableSeconds } from "@/shared/economy";
import { SAMPLE_MP4_BASE64 } from "./sample-clip";
import type { GenerateInput, GenerateOutput, MediaProvider } from "./types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stillSvg(input: GenerateInput): Buffer {
  const width = input.resolution === "720p" ? 1280 : 854;
  const height = input.resolution === "720p" ? 720 : 480;
  const text = escapeXml(input.prompt.slice(0, 180));
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#1c1916"/>
  <text x="32" y="64" fill="#c8f0dc" font-family="Georgia, serif" font-size="28">NR8R still</text>
  <text x="32" y="120" fill="#f3efe6" font-family="Georgia, serif" font-size="18">${text}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

// Mock mode records the catalog price so the ledger behaves like a real job,
// but it never calls a provider and never spends outside money.
export const mockProvider: MediaProvider = {
  name: "mock",
  async generate(input) {
    if (input.kind === "still") {
      return {
        provider: "mock",
        pending: false,
        providerRef: null,
        bytes: stillSvg(input),
        mime: "image/svg+xml",
        width: input.resolution === "720p" ? 1280 : 854,
        height: input.resolution === "720p" ? 720 : 480,
        settledMicroUsd: input.quotedMicroUsd,
      };
    }
    return {
      provider: "mock",
      pending: false,
      providerRef: null,
      bytes: Buffer.from(SAMPLE_MP4_BASE64, "base64"),
      mime: "video/mp4",
      width: input.resolution === "720p" ? 1280 : 854,
      height: input.resolution === "720p" ? 720 : 480,
      settledMicroUsd: input.quotedMicroUsd,
    };
  },
  async poll() {
    return {
      provider: "mock",
      pending: false,
      providerRef: null,
      bytes: null,
      mime: null,
      width: null,
      height: null,
      settledMicroUsd: 0,
    };
  },
};

export function mockDuration(input: GenerateInput): number {
  return input.kind === "video" ? billableSeconds(input.durationSec) : 0;
}
