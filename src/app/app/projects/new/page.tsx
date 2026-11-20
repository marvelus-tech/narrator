import { BriefForm } from "@/components/brief-form";
import { pageMeta } from "@/server/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("newProject");

export default function NewBriefPage() {
  return (
    <div className="wrap section">
      <p className="kicker">New brief</p>
      <h1>Describe the film in one paragraph.</h1>
      <p className="lede">The scripted planner is free. A model rewrite, when configured, spends a planner turn and then one credit after the included allowance.</p>
      <BriefForm />
    </div>
  );
}
