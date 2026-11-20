import { applyStripeEvent, constructBillingEvent } from "@/server/billing";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const event = constructBillingEvent(raw, req.headers.get("stripe-signature"));
    const result = applyStripeEvent(getDb(), event);
    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (err) {
    return jsonError(err);
  }
}
