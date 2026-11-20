import { httpProvider } from "./http";
import { mockProvider } from "./mock";
import { tregProvider } from "./treg";
import type { MediaProvider } from "./types";

export function providerMode(): "mock" | "treg" | "http" {
  const forced = process.env.NARRATOR_PROVIDER;
  if (forced === "mock" || forced === "treg" || forced === "http") return forced;
  if (process.env.MEDIA_HTTP_URL && process.env.MEDIA_HTTP_TOKEN) return "http";
  if (process.env.TREG_TOKEN) return "treg";
  return "mock";
}

export function selectProvider(): MediaProvider {
  const mode = providerMode();
  if (mode === "http") return httpProvider;
  if (mode === "treg" && process.env.TREG_TOKEN) return tregProvider;
  return mockProvider;
}

export function providerLabel(): string {
  return selectProvider().name;
}
