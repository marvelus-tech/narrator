"use client";

import { useState } from "react";
import { creditExamples } from "@/shared/content";
import { planBrief, type Look } from "@/shared/plan-brief";

const stocks = ["clean digital", "35mm", "16mm"];
const grades = ["neutral", "warm", "cool", "high contrast"];
const lenses = ["spherical", "anamorphic"];
const lights = ["soft daylight", "hard sun", "practical night", "overcast"];

const sample =
  "A courier crosses a flooded city at dusk to deliver a letter she is not allowed to read.";

export function StaticDesk({ mode }: { mode: "login" | "signup" | "app" }) {
  const draft = creditExamples[1];
  const origin = (process.env.NEXT_PUBLIC_APP_ORIGIN || "").replace(/\/$/, "");
  const [title, setTitle] = useState<string | null>(null);
  const [scenes, setScenes] = useState<ReturnType<typeof planBrief>["scenes"]>([]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const brief = String(form.get("brief") || "");
    const look: Look = {
      filmStock: String(form.get("filmStock") || stocks[0]),
      grade: String(form.get("grade") || grades[0]),
      lensFamily: String(form.get("lensFamily") || lenses[0]),
      lighting: String(form.get("lighting") || lights[0]),
    };
    const plan = planBrief(brief, look);
    setTitle(plan.title);
    setScenes(plan.scenes);
  }

  const heading = mode === "login" ? "Log in" : mode === "signup" ? "Start a brief" : "Your desk";

  return (
    <div className="wrap section">
      <p className="kicker">Pages preview</p>
      <h1>{heading}</h1>
      <p className="lede">
        This copy drafts the shot list in your browser. Accounts, credit holds, and clips stay on the Narrator server.
        {origin ? (
          <>
            {" "}
            <a href={`${origin}/signup`}>Open the full desk.</a>
          </>
        ) : null}
      </p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Brief
          <textarea name="brief" required minLength={12} maxLength={2000} defaultValue={sample} />
        </label>
        <label>
          Film stock
          <select name="filmStock" defaultValue="35mm">
            {stocks.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Grade
          <select name="grade" defaultValue="cool">
            {grades.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Lens family
          <select name="lensFamily" defaultValue="anamorphic">
            {lenses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Lighting
          <select name="lighting" defaultValue="practical night">
            {lights.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">
          Draft the shot list
        </button>
      </form>
      {title ? (
        <div className="panel">
          <h2>{title}</h2>
          <p>
            Each shot is 5 seconds. A 480p clip quotes {draft.credits} cr · {draft.dollars} before anything runs.
          </p>
          {scenes.map((scene) => (
            <section key={scene.heading}>
              <h3>
                {scene.heading}. {scene.summary}
              </h3>
              <ul>
                {scene.shots.map((shot) => (
                  <li key={shot.action}>
                    {shot.size}, {shot.angle}, {shot.movement}, {shot.lens}, {shot.durationSec}s. {shot.action}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
