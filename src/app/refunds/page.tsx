import { legal } from "@/shared/content";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("refunds");

export default function RefundsPage() {
  return (
    <div className="wrap section">
      <h1>Refunds</h1>
      {legal.refunds.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}
