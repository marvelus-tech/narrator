import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { grantCredits } from "@/server/credits";
import { enqueueGeneration, processQueue } from "@/server/jobs";
import { createProject } from "@/server/projects";
import { rateIdentity } from "@/server/rate";
import { makeUser, tempDb } from "./helpers";

const prevAsset = process.env.ASSET_DIR;
let assetDir = "";

beforeEach(() => {
  assetDir = fs.mkdtempSync(path.join(os.tmpdir(), "narrator-assets-"));
  process.env.ASSET_DIR = assetDir;
  process.env.NARRATOR_PROVIDER = "mock";
});

afterEach(() => {
  if (prevAsset === undefined) delete process.env.ASSET_DIR;
  else process.env.ASSET_DIR = prevAsset;
  process.env.NARRATOR_PROVIDER = "mock";
  fs.rmSync(assetDir, { recursive: true, force: true });
});

describe("generation", () => {
  it("plans a brief, reserves credits, and writes a mock still", async () => {
    const db = tempDb();
    const user = makeUser(db);
    grantCredits(db, { userId: user.id, kind: "promo", millicredits: 20_000, expiresAt: null, sourceId: "t" });
    const projectId = await createProject(db, user, {
      brief: "A cat runs down a wet hill at dusk while the town lights come on.",
      aspect: "16:9",
      look: { filmStock: "35mm", grade: "warm", lensFamily: "spherical", lighting: "soft daylight" },
    });
    const shot = db.prepare(`SELECT id FROM shots WHERE project_id = ? ORDER BY position ASC LIMIT 1`).get(projectId) as { id: string };
    const result = enqueueGeneration(db, {
      user,
      shotId: shot.id,
      kind: "still",
      resolution: "480p",
      takes: 1,
      confirm: true,
      expectedMillicredits: 800,
      requestId: "req-still-1",
    });
    expect(result.jobIds).toHaveLength(1);
    enqueueGeneration(db, {
      user,
      shotId: shot.id,
      kind: "still",
      resolution: "480p",
      takes: 1,
      confirm: true,
      expectedMillicredits: 800,
      requestId: "req-still-1",
    });
    const jobs = db.prepare(`SELECT COUNT(*) AS n FROM jobs`).get() as { n: number };
    expect(jobs.n).toBe(1);
    await processQueue(db);
    const done = db.prepare(`SELECT status, captured_millicredits, output_asset_id FROM jobs WHERE id = ?`).get(result.jobIds[0]) as {
      status: string;
      captured_millicredits: number;
      output_asset_id: string;
    };
    expect(done.status).toBe("succeeded");
    expect(done.captured_millicredits).toBe(800);
    expect(done.output_asset_id).toBeTruthy();
  });

  it("rejects a stale quote, a second free video, and a forwarded-ip bucket", () => {
    const db = tempDb();
    const user = makeUser(db, { plan: "free" });
    grantCredits(db, { userId: user.id, kind: "promo", millicredits: 100_000, expiresAt: null, sourceId: "free-extra" });
    return createProject(db, user, {
      brief: "A courier crosses a flooded street to deliver one dry letter.",
      aspect: "9:16",
      look: { filmStock: "16mm", grade: "cool", lensFamily: "spherical", lighting: "overcast" },
    }).then((projectId) => {
      const shot = db.prepare(`SELECT id, duration_sec FROM shots WHERE project_id = ? LIMIT 1`).get(projectId) as {
        id: string;
        duration_sec: number;
      };
      expect(shot.duration_sec).toBe(5);
      expect(() =>
        enqueueGeneration(db, {
          user,
          shotId: shot.id,
          kind: "video",
          resolution: "480p",
          takes: 1,
          confirm: true,
          expectedMillicredits: 100,
          requestId: "bad-price",
        }),
      ).toThrow(/price_changed/);
      enqueueGeneration(db, {
        user,
        shotId: shot.id,
        kind: "video",
        resolution: "480p",
        takes: 1,
        confirm: true,
        expectedMillicredits: 12_900,
        requestId: "video-1",
      });
      return processQueue(db).then(() => {
      expect(() =>
        enqueueGeneration(db, {
          user,
          shotId: shot.id,
          kind: "video",
          resolution: "480p",
          takes: 1,
          confirm: true,
          expectedMillicredits: 12_900,
          requestId: "video-2",
        }),
      ).toThrow(/free_daily_video/);
      expect(rateIdentity("login", "Person@Example.com")).toBe("login:person@example.com");
      expect(rateIdentity("login", "Person@Example.com")).not.toContain("forwarded");
      });
    });
  });
});
