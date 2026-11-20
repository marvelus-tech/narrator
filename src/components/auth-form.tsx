"use client";

import { useState } from "react";
import Link from "next/link";
import { routes } from "@/shared/routes";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        next,
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
    window.location.href = data.next || routes.app;
  }

  return (
    <form className="form" onSubmit={onSubmit}>
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
          Demo mode printed the verification link here. Open it, then go to your projects.
          <br />
          <a href={verifyUrl}>Verify email</a>
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={pending}>
        {mode === "login" ? "Log in" : "Create account"}
      </button>
      <p className="muted">
        {mode === "login" ? (
          <Link href={routes.signup}>Need an account?</Link>
        ) : (
          <Link href={routes.login}>Already have an account?</Link>
        )}
      </p>
    </form>
  );
}
