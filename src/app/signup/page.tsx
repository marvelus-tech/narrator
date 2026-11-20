import { AuthForm } from "@/components/auth-form";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("signup");

export default function SignupPage() {
  return (
    <div className="wrap section">
      <h1>Create an account</h1>
      <p className="lede">You get 15 credits after the email is verified. Generation stays locked until then.</p>
      <AuthForm mode="signup" />
    </div>
  );
}
