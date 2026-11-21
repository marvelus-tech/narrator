import { describe, expect, it } from "vitest";
import { CAMERA_MOVES, LENSES, directBrief } from "@/shared/director";

describe("director parser", () => {
  it("builds a scene-aware shot list from the brief", () => {
    const plan = directBrief("A courier runs a sealed letter through a flooded street at night.", 5);
    expect(plan.shots.length).toBe(5);
    expect(plan.cast.some((item) => /courier/i.test(item.name))).toBe(true);
    expect(plan.locations.some((item) => /street/i.test(item.name))).toBe(true);
    for (const shot of plan.shots) {
      expect(LENSES).toContain(shot.lens);
      expect(CAMERA_MOVES).toContain(shot.movement);
      expect(shot.durationSec === 5 || shot.durationSec === 10).toBe(true);
    }
    expect(plan.title.length).toBeGreaterThan(0);
    expect(plan.title.length).toBeLessThanOrEqual(80);
  });
});
