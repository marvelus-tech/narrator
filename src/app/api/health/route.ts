import { getStripe } from "@/server/billing";
import { demoBillingAllowed } from "@/server/ids";
import { providerMode } from "@/server/providers";
import { composioConfigured } from "@/server/integrations/composio";

export const runtime = "nodejs";

export function GET() {
  return Response.json({
    ok: true,
    provider: providerMode(),
    billing: getStripe() ? "stripe" : demoBillingAllowed() ? "demo" : "off",
    publishing: composioConfigured(),
  });
}
