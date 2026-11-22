import { isPackId, isPlanId, PACKS, PLANS, type PackId, type PlanId } from "@/shared/economy";

export type CheckoutBody = { kind: "plan"; plan: PlanId } | { kind: "pack"; pack: PackId };

export function inlinePriceData(body: CheckoutBody) {
  if (body.kind === "plan") {
    const plan = PLANS[body.plan];
    return {
      currency: "usd" as const,
      unit_amount: plan.priceCents,
      recurring: { interval: "month" as const },
      product_data: { name: `Nr8tr ${plan.name}` },
    };
  }
  const pack = PACKS[body.pack];
  return {
    currency: "usd" as const,
    unit_amount: pack.priceCents,
    product_data: { name: `Nr8tr ${pack.credits} credits` },
  };
}

export function checkoutMetadata(userId: string, body: CheckoutBody): Record<string, string> {
  if (body.kind === "plan") {
    return { userId, purchaseKind: "plan", tierId: body.plan, plan: body.plan };
  }
  return { userId, purchaseKind: "pack", tierId: body.pack, pack: body.pack };
}

export function purchaseFromMetadata(
  meta: Record<string, unknown> | null | undefined,
): { kind: "plan"; plan: Exclude<PlanId, "free"> } | { kind: "pack"; pack: PackId } | null {
  if (!meta) return null;
  const tier = meta.tierId;
  if (meta.purchaseKind === "plan" && typeof tier === "string" && isPlanId(tier) && tier !== "free") {
    return { kind: "plan", plan: tier };
  }
  if (meta.purchaseKind === "pack" && typeof tier === "string" && isPackId(tier)) {
    return { kind: "pack", pack: tier };
  }
  if (typeof meta.pack === "string" && isPackId(meta.pack)) return { kind: "pack", pack: meta.pack };
  if (typeof meta.plan === "string" && isPlanId(meta.plan) && meta.plan !== "free") {
    return { kind: "plan", plan: meta.plan };
  }
  return null;
}
