"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { clientHasAuthFlag } from "@/shared/auth-flag";
import { SHOWCASE_FILM } from "@/shared/showcase-film";
import { savePending, type PendingPrompt } from "@/shared/pending-prompt";
import { routes } from "@/shared/routes";

const pagesBuild = process.env.NEXT_PUBLIC_PAGES === "1";

export function HeroPromptComposer() {
  const [prompt, setPrompt] = useState(SHOWCASE_FILM.brief);
  const [aspect, setAspect] = useState<PendingPrompt["aspect"]>("2.39:1");
  const [count, setCount] = useState(5);
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => setAuthed(clientHasAuthFlag()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function go(preview: boolean) {
    const text = prompt.trim();
    if (text.length < 12) return;
    savePending({ prompt: text, aspect, count });
    if (preview || authed) {
      router.push(`${routes.app}?autorun=1`);
      return;
    }
    setOpen(true);
  }

  return (
    <>
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        go(false);
      }}
    >
      <label>
        Film prompt
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={12} maxLength={2000} required />
      </label>
      <div className="composer-row">
        <label>
          Aspect
          <select value={aspect} onChange={(event) => setAspect(event.target.value as PendingPrompt["aspect"])}>
            <option>2.39:1</option>
            <option>16:9</option>
            <option>9:16</option>
          </select>
        </label>
        <label>
          Shots
          <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
            <option value={4}>4</option>
            <option value={5}>5</option>
            <option value={6}>6</option>
          </select>
        </label>
        <button className="btn" type="submit">Direct</button>
        {pagesBuild ? (
          <button className="btn-ghost" type="button" onClick={() => go(true)}>Direct in preview</button>
        ) : null}
      </div>
    </form>
    {open ? (
      <div className="modal-back" role="presentation" onClick={() => setOpen(false)}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={(event) => event.stopPropagation()}>
          <p className="kicker">Sign in</p>
          <h2 id="gate-title">Direct this prompt</h2>
          <p className="muted">The prompt stays on this browser and runs in the studio after you connect.</p>
          <AuthForm mode="signup" next={routes.onboarding} />
          <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    ) : null}
    </>
  );
}
