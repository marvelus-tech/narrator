"use client";

import { useState } from "react";
import { formatCredits } from "@/shared/economy";
import { packCards, planCards } from "@/shared/content";

type Bucket = { id: string; kind: string; remaining: number; expiresAt: number | null };

export function BillingPanel({
  buckets,
  plan,
  planStatus,
  periodEnd,
  demo,
}: {
  buckets: Bucket[];
  plan: string;
  planStatus: string;
  periodEnd: number | null;
  demo: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function checkout(body: { kind: "plan"; plan: string } | { kind: "pack"; pack: string }) {
    setPending(true);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { url?: string; message?: string };
    setPending(false);
    if (!res.ok || !data.url) {
      setError(data.message ?? "Checkout is unavailable.");
      return;
    }
    window.location.assign(data.url);
  }

  async function portal() {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = (await res.json()) as { url?: string; message?: string };
    if (!res.ok || !data.url) {
      setError(data.message ?? "The portal needs a Stripe customer. Start a checkout first.");
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div>
      <p>
        Current plan: {plan} ({planStatus}
        {periodEnd ? `, through ${new Date(periodEnd).toLocaleDateString()}` : ""}).
      </p>
      {demo ? <p className="panel">Stripe keys are not set. Checkout on this server grants credits through the same ledger a webhook would use. Do not enable that on a public server.</p> : null}
      <ul>
        {buckets.filter((bucket) => bucket.remaining > 0).map((bucket) => (
          <li key={bucket.id} className="bucket">
            {bucket.kind}: {formatCredits(bucket.remaining)} credits
            {bucket.expiresAt ? `, expires ${new Date(bucket.expiresAt).toLocaleDateString()}` : ", does not expire"}
          </li>
        ))}
      </ul>
      <div className="cards">
        {planCards.map((card) => (
          <article key={card.id} className={card.highlight ? "panel highlight" : "panel"}>
            <h3>{card.name}</h3>
            <p className="price">{card.price}<span> / month</span></p>
            <p>{card.credits} credits. {card.blurb}</p>
            <button className="btn" type="button" disabled={pending} onClick={() => void checkout({ kind: "plan", plan: card.id })}>
              Choose {card.name}
            </button>
          </article>
        ))}
      </div>
      <h2>Packs</h2>
      <p className="muted">Packs do not expire. A paid plan has to be active. The 1,000 credit pack waits 24 hours after signup.</p>
      <div className="cards">
        {packCards.map((pack) => (
          <article key={pack.id} className="panel">
            <h3>{pack.credits} credits</h3>
            <p className="price">{pack.price}</p>
            <p>{pack.note}</p>
            <button className="btn-ghost" type="button" disabled={pending} onClick={() => void checkout({ kind: "pack", pack: pack.id })}>
              Buy pack
            </button>
          </article>
        ))}
      </div>
      <p>
        <button className="btn-ghost" type="button" onClick={() => void portal()}>Open customer portal</button>
      </p>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </div>
  );
}
