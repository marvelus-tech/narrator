import { StackConnect } from "@/components/stack-connect";
import { pageMeta } from "@/server/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("onboarding");

export default function OnboardingPage() {
  return (
    <div className="wrap section">
      <StackConnect />
    </div>
  );
}
