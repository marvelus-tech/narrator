import { ResendButton } from "@/components/resend-button";
import { currentUser } from "@/server/current-user";
import { composioConfigured } from "@/server/integrations/composio";
import { pageMeta } from "@/server/meta";
import { routes } from "@/shared/routes";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("settings");

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect(routes.login);
  return (
    <div className="wrap section">
      <p className="kicker">Settings</p>
      <h1>Account</h1>
      <p>Email: {user.email}</p>
      <p>Verified: {user.email_verified_at ? "yes" : "not yet"}</p>
      <p>Plan: {user.plan} ({user.plan_status})</p>
      {user.chargeback_frozen ? <p className="warn">Generation and publishing are frozen while a card dispute is open.</p> : null}
      {user.email_verified_at ? null : <ResendButton />}
      <p>Every still and clip asks you to confirm the price. This version has no auto-spend switch.</p>
      <p>
        Publishing: {composioConfigured() ? "Composio key is set." : "Composio is not configured, so Drive, Dropbox, and social buttons stay unavailable."}{" "}
        Those calls are separate from quotes, credits, and Stripe. They are offered on Maker and Studio.
      </p>
      <p><Link href={routes.billing}>Open billing</Link></p>
    </div>
  );
}
