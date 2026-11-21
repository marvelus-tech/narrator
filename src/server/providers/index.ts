import { falProvider, keyedMediaProvider } from "./cloud-media";
import { httpProvider } from "./http";
import { localFilmProvider } from "./local-film";
import { mockProvider } from "./mock";
import { tregProvider } from "./treg";
import type { MediaProvider } from "./types";

export function selectProvider(): MediaProvider {
  const forced = process.env.NARRATOR_PROVIDER;
  if (forced === "mock") return mockProvider;
  if (forced === "local") return localFilmProvider;
  if (forced === "http") return httpProvider;
  if (forced === "treg" || (!forced && process.env.TREG_TOKEN)) return tregProvider;
  if (forced === "fal" || (!forced && process.env.FAL_KEY)) return falProvider;
  if (process.env.XAI_API_KEY || process.env.OPENAI_API_KEY) return keyedMediaProvider;
  return localFilmProvider;
}

export function providerLabel(): string {
  return selectProvider().name;
}

export function providerMode(): string {
  return providerLabel();
}
