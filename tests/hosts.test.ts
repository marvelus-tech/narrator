import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPOSIO_ORIGIN, OPENAI_CHAT_URL, TREG_ORIGIN, XAI_CHAT_URL, assertApiUrl } from "@/server/hosts";

describe("locked provider hosts", () => {
  it("rejects a visitor-controlled host", () => {
    expect(() => assertApiUrl("https://example.com/v1")).toThrow();
    expect(() => assertApiUrl("http://api.x.ai/v1/chat/completions")).toThrow();
    expect(() => assertApiUrl(XAI_CHAT_URL)).not.toThrow();
    expect(() => assertApiUrl(OPENAI_CHAT_URL)).not.toThrow();
    expect(TREG_ORIGIN).toBe("https://api.treg.to");
    expect(COMPOSIO_ORIGIN).toBe("https://backend.composio.dev");
  });

  it("does not read PLANNER_URL or a custom Treg base", () => {
    const planner = fs.readFileSync("src/server/planner.ts", "utf8");
    const treg = fs.readFileSync("src/server/providers/treg.ts", "utf8");
    const composio = fs.readFileSync("src/server/composio.ts", "utf8");
    expect(planner).not.toContain("PLANNER_URL");
    expect(treg).not.toContain("TREG_BASE_URL");
    expect(composio).not.toContain("COMPOSIO_BASE_URL");
    expect(planner).toContain("XAI_CHAT_URL");
    expect(planner).toContain("OPENAI_CHAT_URL");
    expect(fs.readFileSync("src/server/hosts.ts", "utf8")).toContain("https://api.x.ai");
    expect(fs.readFileSync("src/server/hosts.ts", "utf8")).toContain("https://api.openai.com");
  });
});
