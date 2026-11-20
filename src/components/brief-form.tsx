"use client";

import { useState } from "react";

const stocks = ["clean digital", "35mm", "16mm"];
const grades = ["neutral", "warm", "cool", "high contrast"];
const lenses = ["spherical", "anamorphic"];
const lights = ["soft daylight", "hard sun", "practical night", "overcast"];

export function BriefForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brief: form.get("brief"),
        aspect: form.get("aspect"),
        look: {
          filmStock: form.get("filmStock"),
          grade: form.get("grade"),
          lensFamily: form.get("lensFamily"),
          lighting: form.get("lighting"),
        },
        useModel: form.get("useModel") === "on",
      }),
    });
    const data = (await res.json()) as { message?: string; next?: string };
    setPending(false);
    if (!res.ok || !data.next) {
      setError(data.message ?? "The brief could not be planned.");
      return;
    }
    window.location.href = data.next;
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        Brief
        <textarea name="brief" required minLength={12} maxLength={2000} placeholder="A courier crosses a flooded city at dusk to deliver a letter she is not allowed to read." />
      </label>
      <label>
        Aspect
        <select name="aspect" defaultValue="16:9">
          <option>16:9</option>
          <option>9:16</option>
          <option>1:1</option>
        </select>
      </label>
      <label>
        Film stock
        <select name="filmStock" defaultValue={stocks[0]}>
          {stocks.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        Grade
        <select name="grade" defaultValue={grades[0]}>
          {grades.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        Lens family
        <select name="lensFamily" defaultValue={lenses[0]}>
          {lenses.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        Lighting
        <select name="lighting" defaultValue={lights[0]}>
          {lights.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="row">
        <input name="useModel" type="checkbox" />
        Rewrite with the model planner if this server has one configured
      </label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>Draft the shot list</button>
    </form>
  );
}
