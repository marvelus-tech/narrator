"use client";

import { useState } from "react";
import { apiUrl, followUrl } from "@/shared/api-base";
import { formatUsdFromCents, PACKS, PLANS } from "@/shared/economy";

type Buy =
  | { kind: "plan"; plan: "starter" | "maker" | "studio" }
  | { kind: "pack"; pack: "pack_200" | "pack_500" | "pack_1000" };

export function UpgradeModal({ open, onClose, reason }: { open: boolean; onClose: () => void; reason?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!open) return null;

  async function buy(body: Buy) {
    setError(null);
    setPending(true);
    const res = await fetch(apiUrl("/api/billing/checkout"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
    setPending(false);
    if (data.url) {
      followUrl(data.url);
      return;
    }
    setError(data.message ?? "Checkout is not available from this page.");
  }

  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-title" onClick={(event) => event.stopPropagation()}>
        <p className="kicker">Credits</p>
        <h2 id="upgrade-title">Upgrade or top up</h2>
        <p className="muted">{reason ?? "A quote that is larger than your balance stays uncharged until you add credits."}</p>
        <div className="stack-grid">
          {(["starter", "maker", "studio"] as const).map((id) => (
            <button key={id} className="btn" type="button" disabled={pending} onClick={() => void buy({ kind: "plan", plan: id })}>
              {PLANS[id].name} {formatUsdFromCents(PLANS[id].priceCents)}
            </button>
          ))}
          {(["pack_200", "pack_500", "pack_1000"] as const).map((id) => (
            <button key={id} className="btn-ghost" type="button" disabled={pending} onClick={() => void buy({ kind: "pack", pack: id })}>
              {PACKS[id].credits} cr {formatUsdFromCents(PACKS[id].priceCents)}
            </button>
          ))}
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button className="btn-ghost" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
