import { afterEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { applyStripeEvent, constructBillingEvent, startPortal } from "@/server/billing";
import { availableMillicredits } from "@/server/credits";
import { demoBillingAllowed } from "@/server/ids";
import { makeUser, tempDb } from "./helpers";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("stripe events", () => {
  it("grants plan credits once and expires them at period end", () => {
    const db = tempDb();
    const user = makeUser(db, { stripe_customer_id: "cus_1" });
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const event = {
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          customer: "cus_1",
          billing_reason: "subscription_cycle",
          metadata: { userId: user.id },
          lines: { data: [{ price: { id: "demo_price_starter" }, period: { end: periodEnd } }] },
        },
      },
    };
    expect(applyStripeEvent(db, event).duplicate).toBe(false);
    expect(applyStripeEvent(db, event).duplicate).toBe(true);
    expect(availableMillicredits(db, user.id)).toBe(240_000);
    const bucket = db.prepare(`SELECT expires_at, kind FROM credit_buckets WHERE source_id = 'in_1'`).get() as {
      expires_at: number;
      kind: string;
    };
    expect(bucket.kind).toBe("plan");
    expect(bucket.expires_at).toBe(periodEnd * 1000);
    const row = db.prepare(`SELECT plan FROM users WHERE id = ?`).get(user.id) as { plan: string };
    expect(row.plan).toBe("starter");
  });

  it("grants a pack with no expiry", () => {
    const db = tempDb();
    const user = makeUser(db, { plan: "maker", plan_status: "active", plan_period_end: Date.now() + 86_400_000 });
    applyStripeEvent(db, {
      id: "evt_pack",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "payment",
          client_reference_id: user.id,
          metadata: { userId: user.id, pack: "pack_200" },
        },
      },
    });
    const bucket = db.prepare(`SELECT expires_at, remaining, kind FROM credit_buckets WHERE source_id = 'cs_1'`).get() as {
      expires_at: number | null;
      remaining: number;
      kind: string;
    };
    expect(bucket.kind).toBe("pack");
    expect(bucket.expires_at).toBeNull();
    expect(bucket.remaining).toBe(200_000);
  });

  it("freezes generation after a dispute", () => {
    const db = tempDb();
    const user = makeUser(db);
    applyStripeEvent(db, {
      id: "evt_dispute",
      type: "charge.dispute.created",
      data: { object: { metadata: { userId: user.id } } },
    });
    const row = db.prepare(`SELECT chargeback_frozen FROM users WHERE id = ?`).get(user.id) as { chargeback_frozen: number };
    expect(row.chargeback_frozen).toBe(1);
  });

  it("rejects a bad webhook signature and keeps demo billing off in production", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const stripe = new Stripe("sk_test_123");
    const payload = JSON.stringify({ id: "evt_x", object: "event", type: "invoice.paid", data: { object: {} } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
    expect(constructBillingEvent(payload, header).id).toBe("evt_x");
    expect(() => constructBillingEvent(payload, "bad")).toThrow();
    process.env.NARRATOR_DEMO = "1";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.NARRATOR_ALLOW_DEMO_BILLING;
    expect(demoBillingAllowed()).toBe(false);
  });

  it("opens a local portal stand-in when demo billing has a customer", async () => {
    process.env.NARRATOR_DEMO = "1";
    delete process.env.STRIPE_SECRET_KEY;
    const user = makeUser(tempDb(), { stripe_customer_id: "demo_cus" });
    await expect(startPortal(user)).resolves.toContain("portal=demo");
  });
});
