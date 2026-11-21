import { describe, expect, it } from "vitest";
import { publishAllowed, startToolkitConnect } from "@/server/composio";

describe("composio connect", () => {
  it("returns setup when the key is missing", async () => {
    const result = await startToolkitConnect({
      userId: "user_1",
      toolkit: "googledrive",
      callbackUrl: "https://example.com/api/integrations/callback",
      apiKey: "",
    });
    expect(result.status).toBe("setup");
    expect(result.redirectUrl).toBeNull();
  });

  it("calls only backend.composio.dev and returns the browser redirect", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("/auth_configs?")) {
        return Response.json({ items: [{ id: "ac_1" }] });
      }
      return Response.json({ redirect_url: "https://accounts.google.com/o/oauth2/v2/auth?x=1", id: "ca_1" });
    };
    const result = await startToolkitConnect({
      userId: "user_1",
      toolkit: "googledrive",
      callbackUrl: "https://nr8r.example/api/integrations/callback",
      apiKey: "test-key",
      fetchImpl,
    });
    expect(result.redirectUrl).toContain("accounts.google.com");
    expect(seen.every((url) => url.startsWith("https://backend.composio.dev/"))).toBe(true);
  });

  it("keeps Drive on every plan and social on Maker and Studio", () => {
    expect(publishAllowed("free", "googledrive")).toBe(true);
    expect(publishAllowed("starter", "dropbox")).toBe(true);
    expect(publishAllowed("free", "youtube")).toBe(false);
    expect(publishAllowed("starter", "twitter")).toBe(false);
    expect(publishAllowed("maker", "tiktok")).toBe(true);
    expect(publishAllowed("studio", "youtube")).toBe(true);
  });
});
