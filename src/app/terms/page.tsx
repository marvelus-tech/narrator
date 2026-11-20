import { legal } from "@/shared/content";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("terms");

export default function TermsPage() {
  return (
    <div className="wrap section">
      <h1>Terms of use</h1>
      {legal.terms.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}
