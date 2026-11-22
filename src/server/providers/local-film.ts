import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { CAMERA_MOVES } from "@/shared/director";
import type { GenerateInput, GenerateOutput, MediaProvider } from "./types";

const run = promisify(execFile);

const PALETTES = [
  { bg: "0x142033", accent: "0xd1fe17", ink: "0xf4f6f8" },
  { bg: "0x2a1424", accent: "0xff5000", ink: "0xf4f6f8" },
  { bg: "0x123028", accent: "0xd1fe17", ink: "0xe7ffe8" },
  { bg: "0x2a2214", accent: "0xf5c16c", ink: "0xfff6e8" },
  { bg: "0x1a2433", accent: "0x9ad7ff", ink: "0xf4f6f8" },
] as const;

const MOVE_LABEL: Record<string, string> = {
  "#dolly-in": "DOLLY IN",
  "#tracking": "TRACKING",
  "#pan-right": "PAN RIGHT",
  "#crane-up": "CRANE UP",
  "#handheld": "HANDHELD",
  "#lock-off": "LOCK OFF",
};

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexColor(value: string): string {
  if (!/^0x[0-9a-f]{6}$/.test(value)) throw new Error("bad_color");
  return value;
}

export function frameSize(aspect: string, resolution: "480p" | "720p"): { w: number; h: number } {
  const hi = resolution === "720p";
  if (aspect.includes("9:16")) return hi ? { w: 720, h: 1280 } : { w: 480, h: 854 };
  if (aspect.includes("16:9")) return hi ? { w: 1280, h: 720 } : { w: 854, h: 480 };
  return hi ? { w: 1280, h: 536 } : { w: 960, h: 402 };
}

function aspectOf(prompt: string): string {
  if (prompt.includes("9:16")) return "9:16";
  if (prompt.includes("16:9")) return "16:9";
  return "2.39:1";
}

function moveOf(prompt: string): string {
  const found = CAMERA_MOVES.find((move) => prompt.toLowerCase().includes(move));
  return found ?? "#lock-off";
}

function fontFile(): string {
  const candidates = [
    path.join(process.cwd(), "src", "fonts", "barlow-condensed-600.ttf"),
    path.join(process.cwd(), "fonts", "barlow-condensed-600.ttf"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("font_missing");
}

function filterPath(file: string): string {
  return file.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function cinematicArgs(input: GenerateInput, outFile: string): string[] {
  const palette = PALETTES[hash(input.prompt) % PALETTES.length] ?? PALETTES[0];
  const bg = hexColor(palette.bg);
  const accent = hexColor(palette.accent);
  const move = moveOf(input.prompt);
  const label = MOVE_LABEL[move] ?? "LOCK OFF";
  const aspect = aspectOf(input.prompt);
  const size = frameSize(aspect, input.resolution === "720p" ? "720p" : "480p");
  const seconds = input.kind === "still" ? 1 : Math.min(10, Math.max(1, Math.round(input.durationSec)));
  const sw = size.w + 320;
  const sh = size.h + 180;
  const boxX = 48 + (hash(input.prompt) % Math.max(1, size.w - 360));
  const boxY = 80 + (hash(input.prompt.slice(1)) % Math.max(1, size.h - 260));
  const t = `min(t/${seconds}\\,1)`;
  let crop = `x='(in_w-out_w)/2':y='(in_h-out_h)/2'`;
  if (move === "#pan-right" || move === "#tracking") crop = `x='(in_w-out_w)*${t}':y='(in_h-out_h)/2'`;
  if (move === "#crane-up") crop = `x='(in_w-out_w)/2':y='(in_h-out_h)*(1-${t})'`;
  if (move === "#handheld") crop = `x='(in_w-out_w)/2+16*sin(8*t)':y='(in_h-out_h)/2+10*cos(7*t)'`;
  if (move === "#dolly-in") crop = `x='(in_w-out_w)*(1-${t})/2':y='(in_h-out_h)*(1-${t})/2'`;
  const font = filterPath(fontFile());
  const graph = [
    `[0][1]blend=all_mode=overlay:all_opacity=0.2`,
    `eq=contrast=1.08:saturation=1.05:gamma=1.05`,
    `noise=alls=6:allf=t`,
    `vignette=PI/12`,
    `drawbox=x=${boxX}:y=${boxY}:w=240:h=160:color=${accent}@0.45:t=fill`,
    `crop=w=${size.w}:h=${size.h}:${crop}`,
    `scale=${size.w}:${size.h}`,
    `drawbox=x=0:y=0:w=iw:h=8:color=${accent}:t=fill`,
    `drawtext=fontfile='${font}':text='Nr8tr':fontcolor=${accent}:fontsize=36:x=28:y=24`,
    `drawtext=fontfile='${font}':text='${label}':fontcolor=0xf4f6f8:fontsize=22:x=28:y=h-48`,
    `format=yuv420p`,
  ].join(",");
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=${bg}:s=${sw}x${sh}:r=24:d=${seconds}`,
    "-f",
    "lavfi",
    "-i",
    `color=c=${accent}:s=${sw}x${sh}:r=24:d=${seconds}`,
    "-filter_complex",
    graph,
  ];
  if (input.kind === "still") {
    args.push("-frames:v", "1", outFile);
  } else {
    args.push("-t", String(seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outFile);
  }
  return args;
}

async function render(input: GenerateInput): Promise<{ bytes: Buffer; mime: string; width: number; height: number }> {
  const size = frameSize(aspectOf(input.prompt), input.resolution === "720p" ? "720p" : "480p");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nr8r-"));
  const outFile = path.join(dir, input.kind === "still" ? "frame.png" : "take.mp4");
  try {
    const args = cinematicArgs(input, outFile);
    if (input.prompt && args.join("\n").includes(input.prompt)) throw new Error("prompt_leaked");
    await run("ffmpeg", args, { timeout: 60_000 });
    return {
      bytes: fs.readFileSync(outFile),
      mime: input.kind === "still" ? "image/png" : "video/mp4",
      width: size.w,
      height: size.h,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function done(input: GenerateInput, file: { bytes: Buffer; mime: string; width: number; height: number }): GenerateOutput {
  return {
    provider: "local",
    pending: false,
    providerRef: null,
    bytes: file.bytes,
    mime: file.mime,
    width: file.width,
    height: file.height,
    settledMicroUsd: input.quotedMicroUsd,
  };
}

export const localFilmProvider: MediaProvider = {
  name: "local",
  async generate(input) {
    return done(input, await render(input));
  },
  async poll() {
    return {
      provider: "local",
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
