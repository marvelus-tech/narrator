import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { assertPackAllowed } from "@/server/billing";
import { ApiError } from "@/server/errors";
import { sessionCookie } from "@/server/auth";
import { assertSameOrigin } from "@/server/rate";
import { makeUser, tempDb } from "./helpers";

describe("abuse controls", () => {
  it("blocks the 1000 credit pack for a day and blocks packs without a paid plan", () => {
    const db = tempDb();
    const fresh = makeUser(db, {
      plan: "starter",
      plan_status: "active",
      plan_period_end: Date.now() + 86_400_000,
      created_at: Date.now() - 60_000,
    });
    expect(() => assertPackAllowed(fresh, "pack_1000")).toThrow(ApiError);
    expect(() => assertPackAllowed(fresh, "pack_200")).not.toThrow();
    const free = makeUser(db);
    expect(() => assertPackAllowed(free, "pack_200")).toThrow(/pack_requires_plan/);
  });

  it("matches Origin to Host, not the framework request url", () => {
    const call = (headers: Record<string, string>) =>
      assertSameOrigin(new Request("http://localhost:3000/api/auth/signup", { headers }));
    expect(() =>
      call({ origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" }),
    ).not.toThrow();
    expect(() => call({ origin: "http://evil.example", host: "127.0.0.1:3000" })).toThrow(
      /origin_mismatch/,
    );
    expect(() => call({ host: "127.0.0.1:3000" })).toThrow(/origin_required/);
  });

  it("marks the session cookie Secure only on an https site url", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(sessionCookie("token")).not.toContain("Secure");
    process.env.NEXT_PUBLIC_SITE_URL = "https://narrator.example";
    expect(sessionCookie("token")).toContain("Secure");
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prev;
  });

  it("keeps composio out of the ledger, jobs, and stripe webhook", () => {
    const files = [
      "src/server/credits.ts",
      "src/server/jobs.ts",
      "src/server/billing.ts",
      "src/server/planner.ts",
      "src/app/api/billing/webhook/route.ts",
      "src/app/api/shots/[id]/generate/route.ts",
    ];
    for (const file of files) {
      expect(fs.readFileSync(file, "utf8").toLowerCase()).not.toContain("composio");
    }
  });
});
