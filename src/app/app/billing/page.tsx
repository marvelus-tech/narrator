import { BillingPanel } from "@/components/billing-panel";
import { getStripe } from "@/server/billing";
import { listBuckets } from "@/server/credits";
import { currentUser } from "@/server/current-user";
import { getDb } from "@/server/db";
import { demoBillingAllowed } from "@/server/ids";
import { pageMeta } from "@/server/meta";
import { routes } from "@/shared/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("billing");

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; portal?: string }> }) {
  const user = await currentUser();
  if (!user) redirect(routes.login);
  const query = await searchParams;
  const buckets = listBuckets(getDb(), user.id);
  return (
    <div className="wrap section">
      <p className="kicker">Billing</p>
      <h1>Credits and the plan</h1>
      {query.checkout === "success" ? <p className="panel">Checkout returned. Credits appear when the signed webhook is processed.</p> : null}
      {query.checkout === "cancel" ? <p className="panel">Checkout was canceled. No credits were added.</p> : null}
      {query.checkout === "demo" ? <p className="panel">Demo checkout updated the ledger.</p> : null}
      {query.portal === "demo" ? <p className="panel">Demo mode has no Stripe customer portal. The plan and the credit buckets on this page are the source of truth.</p> : null}
      <BillingPanel
        buckets={buckets.map((bucket) => ({
          id: bucket.id,
          kind: bucket.kind,
          remaining: bucket.remaining,
          expiresAt: bucket.expires_at,
        }))}
        plan={user.plan}
        planStatus={user.plan_status}
        periodEnd={user.plan_period_end}
        demo={!getStripe() && demoBillingAllowed()}
      />
    </div>
  );
}
