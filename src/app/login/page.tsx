import { AuthForm } from "@/components/auth-form";
import { pageMeta } from "@/server/meta";
import { safeNextPath } from "@/shared/routes";

export const metadata = pageMeta("login");

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; verify?: string }> }) {
  const query = await searchParams;
  return (
    <div className="wrap section">
      <h1>Log in</h1>
      <p className="lede">Open your projects and the shot lists you have already priced.</p>
      {query.verify === "invalid" ? <p className="error">That verification link is invalid or expired.</p> : null}
      <AuthForm mode="login" next={safeNextPath(query.next)} />
    </div>
  );
}
