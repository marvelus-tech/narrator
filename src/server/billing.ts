import type { Database } from "better-sqlite3";
import Stripe from "stripe";
import { creditsToMilli, isPackId, isPlanId, PACKS, PLANS, type PackId, type PlanId } from "@/shared/economy";
import type { UserRow } from "./auth";
import { getUserByCustomer, getUserById } from "./auth";
import { clawbackUnspent, grantCredits } from "./credits";
import { ApiError } from "./errors";
import { withTx } from "./db";
import { demoBillingAllowed, newId, siteUrl } from "./ids";

export type BillingEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

const DEMO_PRICE: Record<string, PlanId | PackId> = {
  demo_price_starter: "starter",
  demo_price_maker: "maker",
  demo_price_studio: "studio",
  demo_price_pack_200: "pack_200",
  demo_price_pack_500: "pack_500",
  demo_price_pack_1000: "pack_1000",
};

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function priceIdForPlan(plan: PlanId): string | null {
  const env: Record<PlanId, string | undefined> = {
    free: undefined,
    starter: process.env.STRIPE_PRICE_STARTER,
    maker: process.env.STRIPE_PRICE_MAKER,
    studio: process.env.STRIPE_PRICE_STUDIO,
  };
  return env[plan] || null;
}

export function priceIdForPack(pack: PackId): string | null {
  const env: Record<PackId, string | undefined> = {
    pack_200: process.env.STRIPE_PRICE_PACK_200,
    pack_500: process.env.STRIPE_PRICE_PACK_500,
    pack_1000: process.env.STRIPE_PRICE_PACK_1000,
  };
  return env[pack] || null;
}

function catalogId(priceId: string): PlanId | PackId | null {
  if (priceId in DEMO_PRICE) return DEMO_PRICE[priceId] ?? null;
  for (const plan of ["starter", "maker", "studio"] as const) {
    if (priceIdForPlan(plan) === priceId) return plan;
  }
  for (const pack of ["pack_200", "pack_500", "pack_1000"] as const) {
    if (priceIdForPack(pack) === priceId) return pack;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function metaUserId(object: Record<string, unknown>): string | null {
  const meta = asRecord(object.metadata);
  if (typeof meta?.userId === "string") return meta.userId;
  const parent = asRecord(object.subscription_details) ?? asRecord(object.parent);
  const parentMeta = asRecord(parent?.metadata);
  if (typeof parentMeta?.userId === "string") return parentMeta.userId;
  const client = object.client_reference_id;
  if (typeof client === "string") return client;
  return null;
}

function priceFromLine(line: Record<string, unknown>): string | null {
  const price = asRecord(line.price);
  if (typeof price?.id === "string") return price.id;
  const pricing = asRecord(line.pricing);
  const details = asRecord(pricing?.price_details);
  if (typeof details?.price === "string") return details.price;
  return null;
}

function periodEndMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value < 10_000_000_000 ? value * 1000 : value;
}

function userForObject(db: Database, object: Record<string, unknown>): UserRow | null {
  const userId = metaUserId(object);
  if (userId) {
    const user = getUserById(db, userId);
    if (user) return user;
  }
  const customer = object.customer;
  if (typeof customer === "string") return getUserByCustomer(db, customer);
  return null;
}

function grantPlan(db: Database, user: UserRow, plan: PlanId, periodEnd: number, sourceId: string, customerId: string | null, now: number) {
  grantCredits(db, {
    userId: user.id,
    kind: "plan",
    millicredits: creditsToMilli(PLANS[plan].credits),
    expiresAt: periodEnd,
    sourceId,
    now,
  });
  db.prepare(
    `UPDATE users SET plan = ?, plan_status = 'active', plan_period_end = ?, stripe_customer_id = COALESCE(?, stripe_customer_id) WHERE id = ?`,
  ).run(plan, periodEnd, customerId, user.id);
}

function grantPack(db: Database, user: UserRow, pack: PackId, sourceId: string, customerId: string | null, now: number) {
  grantCredits(db, {
    userId: user.id,
    kind: "pack",
    millicredits: creditsToMilli(PACKS[pack].credits),
    expiresAt: null,
    sourceId,
    now,
  });
  if (customerId) {
    db.prepare(`UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, ?) WHERE id = ?`).run(customerId, user.id);
  }
}

export function applyStripeEvent(db: Database, event: BillingEvent, now = Date.now()): { duplicate: boolean } {
  return withTx(db, () => {
    const existing = db.prepare(`SELECT id FROM stripe_events WHERE id = ?`).get(event.id);
    if (existing) return { duplicate: true };
    const object = event.data.object;
    if (event.type === "checkout.session.completed") {
      const user = userForObject(db, object);
      const mode = object.mode;
      const customer = typeof object.customer === "string" ? object.customer : null;
      if (user && mode === "payment") {
        const pack = asRecord(object.metadata)?.pack;
        if (typeof pack === "string" && isPackId(pack)) grantPack(db, user, pack, String(object.id), customer, now);
      } else if (user && customer) {
        db.prepare(`UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, ?) WHERE id = ?`).run(customer, user.id);
      }
    } else if (event.type === "invoice.paid") {
      const reason = object.billing_reason;
      if (reason === "subscription_create" || reason === "subscription_cycle") {
        const lines = asRecord(object.lines);
        const data = Array.isArray(lines?.data) ? (lines?.data as Record<string, unknown>[]) : [];
        const line = data[0];
        const priceId = line ? priceFromLine(line) : null;
        const period = line ? asRecord(line.period) : null;
        const periodEnd = periodEndMs(period?.end) ?? now + 30 * 24 * 60 * 60 * 1000;
        const catalog = priceId ? catalogId(priceId) : null;
        const user = userForObject(db, object);
        if (catalog && isPlanId(catalog) && catalog !== "free" && !user) {
          throw new ApiError(409, "not_found");
        }
        if (user && catalog && isPlanId(catalog) && catalog !== "free") {
          const customer = typeof object.customer === "string" ? object.customer : null;
          grantPlan(db, user, catalog, periodEnd, String(object.id), customer, now);
        }
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const user = userForObject(db, object);
      if (user) {
        const status = typeof object.status === "string" ? object.status : "canceled";
        const periodEnd = periodEndMs(object.current_period_end);
        const items = asRecord(object.items);
        const data = Array.isArray(items?.data) ? (items?.data as Record<string, unknown>[]) : [];
        const price = data[0] ? asRecord(asRecord(data[0])?.price) : null;
        const catalog = typeof price?.id === "string" ? catalogId(price.id) : null;
        const plan = catalog && isPlanId(catalog) ? catalog : user.plan;
        const ended = status === "canceled" || status === "unpaid" || status === "incomplete_expired";
        db.prepare(`UPDATE users SET plan = ?, plan_status = ?, plan_period_end = COALESCE(?, plan_period_end) WHERE id = ?`).run(
          ended && periodEnd !== null && periodEnd <= now ? "free" : plan,
          status,
          periodEnd,
          user.id,
        );
      }
    } else if (event.type === "charge.dispute.created") {
      const user = userForObject(db, object);
      if (user) db.prepare(`UPDATE users SET chargeback_frozen = 1 WHERE id = ?`).run(user.id);
    } else if (event.type === "charge.refunded") {
      const meta = asRecord(object.metadata);
      const sourceId = typeof meta?.sourceId === "string" ? meta.sourceId : null;
      const user = userForObject(db, object);
      if (user && sourceId) clawbackUnspent(db, { userId: user.id, sourceId, now });
    }
    db.prepare(`INSERT INTO stripe_events (id, type, processed_at) VALUES (?, ?, ?)`).run(event.id, event.type, now);
    return { duplicate: false };
  });
}

export function assertPackAllowed(user: UserRow, pack: PackId, now = Date.now()) {
  const paid = user.plan === "starter" || user.plan === "maker" || user.plan === "studio";
  const inPeriod = (user.plan_period_end ?? 0) > now && user.plan_status !== "unpaid";
  if (!paid || !inPeriod) throw new ApiError(403, "pack_requires_plan");
  if (now - user.created_at < PACKS[pack].minAccountAgeMs) throw new ApiError(403, "pack_too_new");
}

export async function startCheckout(
  db: Database,
  user: UserRow,
  body: { kind: "plan"; plan: PlanId } | { kind: "pack"; pack: PackId },
): Promise<{ url: string; demo: boolean }> {
  if (body.kind === "pack") assertPackAllowed(user, body.pack);
  const stripe = getStripe();
  if (!stripe) {
    if (!demoBillingAllowed()) throw new ApiError(503, "billing_unconfigured");
    return { url: demoApply(db, user, body), demo: true };
  }
  const price = body.kind === "plan" ? priceIdForPlan(body.plan) : priceIdForPack(body.pack);
  if (!price) throw new ApiError(503, "billing_unconfigured");
  let customer = user.stripe_customer_id;
  if (!customer) {
    const created = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
    customer = created.id;
    db.prepare(`UPDATE users SET stripe_customer_id = ? WHERE id = ?`).run(customer, user.id);
  }
  const success = `${siteUrl()}/app/billing?checkout=success`;
  const cancel = `${siteUrl()}/app/billing?checkout=cancel`;
  if (body.kind === "plan") {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      metadata: { userId: user.id, plan: body.plan },
      subscription_data: { metadata: { userId: user.id, plan: body.plan } },
    });
    if (!session.url) throw new ApiError(502, "billing_unconfigured");
    return { url: session.url, demo: false };
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    success_url: success,
    cancel_url: cancel,
    metadata: { userId: user.id, pack: body.pack },
  });
  if (!session.url) throw new ApiError(502, "billing_unconfigured");
  return { url: session.url, demo: false };
}

function demoApply(db: Database, user: UserRow, body: { kind: "plan"; plan: PlanId } | { kind: "pack"; pack: PackId }): string {
  const now = Date.now();
  if (body.kind === "plan") {
    applyStripeEvent(db, {
      id: `demo_evt_${newId()}`,
      type: "invoice.paid",
      data: {
        object: {
          id: `demo_in_${newId()}`,
          customer: user.stripe_customer_id || `demo_cus_${user.id}`,
          billing_reason: "subscription_create",
          metadata: { userId: user.id },
          lines: {
            data: [
              {
                price: { id: `demo_price_${body.plan}` },
                period: { end: Math.floor(now / 1000) + 30 * 24 * 60 * 60 },
              },
            ],
          },
        },
      },
    });
  } else {
    applyStripeEvent(db, {
      id: `demo_evt_${newId()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `demo_cs_${newId()}`,
          mode: "payment",
          customer: user.stripe_customer_id || `demo_cus_${user.id}`,
          client_reference_id: user.id,
          metadata: { userId: user.id, pack: body.pack },
        },
      },
    });
  }
  return `${siteUrl()}/app/billing?checkout=demo`;
}

export async function startPortal(user: UserRow): Promise<string> {
  const stripe = getStripe();
  if (!user.stripe_customer_id) throw new ApiError(400, "no_customer");
  if (!stripe) {
    if (!demoBillingAllowed()) throw new ApiError(400, "no_customer");
    return `${siteUrl()}/app/billing?portal=demo`;
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${siteUrl()}/app/billing`,
  });
  return session.url;
}

export function constructBillingEvent(raw: string, signature: string | null): BillingEvent {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !signature) throw new ApiError(400, "invalid_body");
  const event = stripe.webhooks.constructEvent(raw, signature, secret);
  return { id: event.id, type: event.type, data: { object: event.data.object as unknown as Record<string, unknown> } };
}
