import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { cinematicArgs, localFilmProvider } from "@/server/providers/local-film";

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const input = {
  kind: "video" as const,
  prompt: "A courier runs a sealed letter through a flooded street at night. 2.39:1 #dolly-in",
  resolution: "480p" as const,
  durationSec: 2,
  idempotencyKey: "local-test",
  quotedMicroUsd: 12900,
};

describe("local film", () => {
  it("keeps the prompt out of the ffmpeg arguments", () => {
    const args = cinematicArgs(input, "/tmp/nr8r-test.mp4");
    expect(args.join("\n")).not.toContain(input.prompt);
    expect(args.join("\n")).toContain("Nr8tr");
    expect(args).toContain("libx264");
  });

  it.skipIf(!hasFfmpeg())("writes a png still and an h264 mp4", async () => {
    const still = await localFilmProvider.generate({ ...input, kind: "still", durationSec: 1 });
    expect(still.mime).toBe("image/png");
    expect(still.bytes?.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const video = await localFilmProvider.generate(input);
    expect(video.mime).toBe("video/mp4");
    expect(video.bytes?.subarray(4, 8).toString("ascii")).toBe("ftyp");
    expect(video.settledMicroUsd).toBe(input.quotedMicroUsd);
  }, 30_000);
});
