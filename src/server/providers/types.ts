import type { Resolution } from "@/shared/economy";

export type GenerateInput = {
  kind: "still" | "video";
  prompt: string;
  resolution: Resolution;
  durationSec: number;
  idempotencyKey: string;
  quotedMicroUsd: number;
};

export type GenerateOutput = {
  provider: string;
  pending: boolean;
  providerRef: string | null;
  bytes: Buffer | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  settledMicroUsd: number | null;
};

export interface MediaProvider {
  name: string;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  poll(ref: string, input: GenerateInput): Promise<GenerateOutput>;
}
