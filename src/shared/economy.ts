// Face value is $0.05. A 1.25 markup is bill * 25_000 millicredits per dollar,
// which is the same as micro-USD / 40. Rounding is up to the next 0.1 credit.
// A zero provider bill captures zero. The 0.1 floor applies only when the provider billed something.

export const FACE_VALUE_CENTS = 5;
export const MARKUP_NUMERATOR = 125;
export const MARKUP_DENOMINATOR = 100;

export const STILL_MICRO_USD = 30_000;
export const VIDEO_480_MICRO_PER_SEC = 102_800;
export const VIDEO_720_MICRO_PER_SEC = 270_000;
export const MAX_VIDEO_SECONDS = 10;
export const MAX_SHOT_SECONDS = 60;

export type PlanId = "free" | "starter" | "maker" | "studio";
export type PackId = "pack_200" | "pack_500" | "pack_1000";
export type Resolution = "480p" | "720p";

export type PlanSpec = {
  id: PlanId;
  name: string;
  priceCents: number;
  credits: number;
  concurrency: number;
  takes: number;
  dailyMicroUsd: number;
  plannerTurns: number;
  blurb: string;
};

export const PLANS: Record<PlanId, PlanSpec> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    credits: 15,
    concurrency: 1,
    takes: 1,
    dailyMicroUsd: 1_000_000,
    plannerTurns: 0,
    blurb: "15 credits once, after you verify email. One draft clip a day.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceCents: 1500,
    credits: 240,
    concurrency: 2,
    takes: 1,
    dailyMicroUsd: 8_000_000,
    plannerTurns: 30,
    blurb: "A short 720p film with a little room, or a stack of 480p drafts.",
  },
  maker: {
    id: "maker",
    name: "Maker",
    priceCents: 2900,
    credits: 500,
    concurrency: 4,
    takes: 2,
    dailyMicroUsd: 20_000_000,
    plannerTurns: 80,
    blurb: "One finished six-shot film plus another take on most shots.",
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceCents: 5900,
    credits: 1090,
    concurrency: 8,
    takes: 4,
    dailyMicroUsd: 40_000_000,
    plannerTurns: 200,
    blurb: "About thirty finished 5 second shots, or several draft films.",
  },
};

export const PAID_PLANS: PlanId[] = ["starter", "maker", "studio"];

export type PackSpec = {
  id: PackId;
  credits: number;
  priceCents: number;
  minAccountAgeMs: number;
};

export const PACKS: Record<PackId, PackSpec> = {
  pack_200: { id: "pack_200", credits: 200, priceCents: 1000, minAccountAgeMs: 0 },
  pack_500: { id: "pack_500", credits: 500, priceCents: 2500, minAccountAgeMs: 0 },
  pack_1000: { id: "pack_1000", credits: 1000, priceCents: 5000, minAccountAgeMs: 24 * 60 * 60 * 1000 },
};

export const PLANNER_TURN_MILLICREDITS = 1000;

export function millicreditsForMicroUsd(microUsd: number): number {
  if (!Number.isSafeInteger(microUsd) || microUsd < 0) {
    throw new Error("provider cost must be a non-negative integer micro-USD");
  }
  if (microUsd === 0) return 0;
  const exact = microUsd / 40;
  const stepped = Math.ceil(exact / 100 - 1e-9) * 100;
  return Math.max(100, stepped);
}

export function billableSeconds(durationSec: number): number {
  const rounded = Math.round(durationSec);
  if (!Number.isFinite(rounded)) return 1;
  return Math.min(MAX_VIDEO_SECONDS, Math.max(1, rounded));
}

export function videoMicroUsd(resolution: Resolution, durationSec: number): number {
  const seconds = billableSeconds(durationSec);
  const rate = resolution === "720p" ? VIDEO_720_MICRO_PER_SEC : VIDEO_480_MICRO_PER_SEC;
  return rate * seconds;
}

export function quoteStill(): { providerMicroUsd: number; millicredits: number } {
  return {
    providerMicroUsd: STILL_MICRO_USD,
    millicredits: millicreditsForMicroUsd(STILL_MICRO_USD),
  };
}

export function quoteVideo(resolution: Resolution, durationSec: number) {
  const seconds = billableSeconds(durationSec);
  const providerMicroUsd = videoMicroUsd(resolution, seconds);
  return {
    seconds,
    resolution,
    providerMicroUsd,
    millicredits: millicreditsForMicroUsd(providerMicroUsd),
  };
}

export function formatCredits(millicredits: number): string {
  const value = millicredits / 1000;
  const text = value.toFixed(1);
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

export function formatUsdFromCents(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatCreditUsd(millicredits: number): string {
  // Face value is $0.05 per credit. One millicredit is $0.00005, which is 50 micro-dollars.
  const micro = Math.round(millicredits * 50);
  const cents = micro / 10_000;
  if (Number.isInteger(cents)) return formatUsdFromCents(cents);
  return `$${(micro / 1_000_000).toFixed(3).replace(/0+$/, "")}`;
}

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

export function isPackId(value: string): value is PackId {
  return value in PACKS;
}

export function creditsToMilli(credits: number): number {
  return credits * 1000;
}
