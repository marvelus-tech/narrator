import { legal } from "@/shared/content";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("privacy");

export default function PrivacyPage() {
  return (
    <div className="wrap section">
      <h1>Privacy</h1>
      {legal.privacy.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}
