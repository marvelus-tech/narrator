"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl, followUrl } from "@/shared/api-base";
import { routes } from "@/shared/routes";

export function AuthForm({ mode, next, connectDefault = true }: { mode: "login" | "signup"; next?: string; connectDefault?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [connect, setConnect] = useState(connectDefault);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const google = new URLSearchParams(window.location.search).get("google");
      if (google === "setup") setError("Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.");
      if (google === "denied") setError("Google sign-in was not completed.");
      if (google === "rate") setError("Too many Google sign-in attempts. Wait and try again.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await fetch(apiUrl(mode === "login" ? "/api/auth/login" : "/api/auth/signup"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        next,
        connect,
      }),
    });
    const data = (await res.json()) as { message?: string; next?: string; devVerifyUrl?: string };
    setPending(false);
    if (!res.ok) {
      setError(data.message ?? "Try again.");
      return;
    }
    if (data.devVerifyUrl) {
      setVerifyUrl(data.devVerifyUrl);
      return;
    }
    followUrl(data.next || routes.app);
  }

  const googleHref = `${apiUrl("/api/auth/google")}?connect=${connect ? "1" : "0"}`;

  return (
    <form className="form" onSubmit={onSubmit}>
      <a className="btn" href={googleHref}>Continue with Google</a>
      <label className="check">
        <input type="checkbox" checked={connect} onChange={(event) => setConnect(event.target.checked)} />
        Connect Google Drive, Dropbox & YouTube right after sign-in
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} required />
      </label>
      {mode === "signup" ? <p className="muted">At least 10 characters. We send a verification link before the first generation.</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {verifyUrl ? (
        <p className="panel">
          Mail is not configured, so the verification link is shown here. Open it, then connect your stack.
          <br />
          <a href={verifyUrl}>Verify email</a>
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={pending}>
        {mode === "login" ? "Log in" : "Create account"}
      </button>
      <p className="muted">
        {mode === "login" ? <Link href={routes.signup}>Need an account?</Link> : <Link href={routes.login}>Already have an account?</Link>}
      </p>
    </form>
  );
}
