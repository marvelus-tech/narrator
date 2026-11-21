import { describe, expect, it } from "vitest";
import { applyStripeEvent } from "@/server/billing";
import { availableMillicredits } from "@/server/credits";
import { checkoutMetadata, inlinePriceData } from "@/server/stripe";
import { makeUser, tempDb } from "./helpers";

describe("inline stripe prices", () => {
  it("prices plans and packs without a catalog id", () => {
    expect(inlinePriceData({ kind: "plan", plan: "starter" }).unit_amount).toBe(1500);
    expect(inlinePriceData({ kind: "plan", plan: "maker" }).unit_amount).toBe(2900);
    expect(inlinePriceData({ kind: "plan", plan: "studio" }).unit_amount).toBe(5900);
    expect(inlinePriceData({ kind: "pack", pack: "pack_200" }).unit_amount).toBe(1000);
    const meta = checkoutMetadata("user_1", { kind: "plan", plan: "maker" });
    expect(meta.purchaseKind).toBe("plan");
    expect(meta.tierId).toBe("maker");
    expect(meta.userId).toBe("user_1");
  });

  it("grants a plan from metadata when no price id is present", () => {
    const db = tempDb();
    const user = makeUser(db, { stripe_customer_id: "cus_inline" });
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    applyStripeEvent(db, {
      id: "evt_inline_plan",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_inline",
          customer: "cus_inline",
          billing_reason: "subscription_create",
          metadata: { userId: user.id, purchaseKind: "plan", tierId: "starter" },
          lines: { data: [{ period: { end: periodEnd } }] },
        },
      },
    });
    expect(availableMillicredits(db, user.id)).toBe(240_000);
  });

  it("grants a pack from purchase metadata and does not grant a plan on checkout", () => {
    const db = tempDb();
    const user = makeUser(db, { plan: "maker", plan_status: "active", plan_period_end: Date.now() + 86_400_000 });
    applyStripeEvent(db, {
      id: "evt_inline_pack",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_inline",
          mode: "payment",
          customer: "cus_pack",
          metadata: { userId: user.id, purchaseKind: "pack", tierId: "pack_500" },
        },
      },
    });
    expect(availableMillicredits(db, user.id)).toBe(500_000);
    const before = availableMillicredits(db, user.id);
    applyStripeEvent(db, {
      id: "evt_sub_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_plan",
          mode: "subscription",
          customer: "cus_pack",
          metadata: { userId: user.id, purchaseKind: "plan", tierId: "studio" },
        },
      },
    });
    expect(availableMillicredits(db, user.id)).toBe(before);
  });
});
