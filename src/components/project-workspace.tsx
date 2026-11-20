"use client";

import { useEffect, useState } from "react";
import { formatCredits, formatCreditUsd, PLANS, type PlanId } from "@/shared/economy";

type Shot = {
  id: string;
  position: number;
  action: string;
  size: string;
  angle: string;
  movement: string;
  lens: string;
  focus: string;
  lighting: string;
  mood: string;
  durationSec: number;
  soundNote: string;
  elementIds: string[];
  quotes: { still: number; video480: number; video720: number };
};

export type WorkspaceData = {
  project: {
    id: string;
    title: string;
    brief: string;
    aspect: string;
    look: { filmStock: string; grade: string; lensFamily: string; lighting: string };
  };
  scenes: { id: string; heading: string; summary: string; shots: Shot[] }[];
  elements: { id: string; kind: string; name: string; notes: string; assetIds: string[] }[];
  assets: { id: string; kind: string; mime: string; bytes: number; width: number | null; height: number | null }[];
  jobs: {
    id: string;
    shot_id: string;
    kind: string;
    status: string;
    resolution: string;
    quote_millicredits: number;
    error: string | null;
    output_asset_id: string | null;
  }[];
  balance: { millicredits: number; buckets: { id: string; kind: string; remaining: number; expiresAt: number | null }[] };
  plan: string;
  integrations: { configured: boolean; canPublish: boolean };
};

export function ProjectWorkspace({ initial }: { initial: WorkspaceData }) {
  const [data, setData] = useState(initial);
  const [resolution, setResolution] = useState<"480p" | "720p">("480p");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const plan = (data.plan in PLANS ? data.plan : "free") as PlanId;
  const active = data.jobs.some((job) => job.status === "queued" || job.status === "running");

  async function refresh() {
    const res = await fetch(`/api/projects/${data.project.id}`);
    if (!res.ok) return;
    setData((await res.json()) as WorkspaceData);
  }

  useEffect(() => {
    if (!active) return;
    const projectId = data.project.id;
    const timer = setInterval(() => {
      void fetch(`/api/projects/${projectId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body: WorkspaceData | null) => {
          if (body) setData(body);
        });
    }, 1500);
    return () => clearInterval(timer);
  }, [active, data.project.id]);

  async function saveShot(shot: Shot, form: FormData) {
    setError(null);
    const res = await fetch(`/api/shots/${shot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: form.get("action"),
        size: form.get("size"),
        angle: form.get("angle"),
        movement: form.get("movement"),
        lens: form.get("lens"),
        focus: form.get("focus"),
        lighting: form.get("lighting"),
        mood: form.get("mood"),
        durationSec: Number(form.get("durationSec")),
        soundNote: form.get("soundNote") ?? "",
      }),
    });
    const body = (await res.json()) as { message?: string };
    if (!res.ok) setError(body.message ?? "Could not save the shot.");
    else await refresh();
  }

  async function generate(shot: Shot, kind: "still" | "video") {
    setError(null);
    const expected = kind === "still" ? shot.quotes.still : resolution === "720p" ? shot.quotes.video720 : shot.quotes.video480;
    const res = await fetch(`/api/shots/${shot.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        resolution: kind === "still" ? "480p" : resolution,
        takes: 1,
        confirm: true,
        expectedMillicredits: expected,
        requestId: crypto.randomUUID(),
      }),
    });
    const body = (await res.json()) as { message?: string };
    if (!res.ok) setError(body.message ?? "Could not start the job.");
    await refresh();
  }

  async function addElement(form: FormData) {
    const res = await fetch("/api/elements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        projectId: data.project.id,
        kind: form.get("kind"),
        name: form.get("name"),
        notes: form.get("notes") ?? "",
      }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? "Could not add the reference.");
      return;
    }
    await refresh();
  }

  async function upload(form: FormData) {
    form.set("projectId", data.project.id);
    const res = await fetch("/api/assets", { method: "POST", body: form });
    const body = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !body.id) {
      setError(body.message ?? "Upload failed.");
      return;
    }
    const elementId = String(form.get("elementId") ?? "");
    if (elementId) {
      await fetch("/api/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach", elementId, assetId: body.id }),
      });
    }
    await refresh();
  }

  async function toggleLink(shotId: string, elementId: string, linked: boolean) {
    await fetch("/api/elements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", shotId, elementId, linked }),
    });
    await refresh();
  }

  async function assemble() {
    setNote(null);
    const res = await fetch(`/api/projects/${data.project.id}/assemble`, { method: "POST" });
    const body = (await res.json()) as { message?: string; assetId?: string };
    if (!res.ok) setNote(body.message ?? "The cut is unavailable.");
    else setNote("Silent cut is ready in the file list.");
    await refresh();
  }

  async function publish(assetId: string, target: "drive" | "dropbox" | "social") {
    const res = await fetch("/api/integrations/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, target }),
    });
    const body = (await res.json()) as { message?: string };
    setNote(res.ok ? `Sent to ${target}.` : body.message ?? "Publishing is unavailable.");
  }

  return (
    <div className="wrap section">
      <p className="kicker">{data.project.aspect} · {data.plan}</p>
      <h1>{data.project.title}</h1>
      <p className="lede">{data.project.brief}</p>
      <p className="balance">
        Balance {formatCredits(data.balance.millicredits)} credits ({formatCreditUsd(data.balance.millicredits)} face value).
        This plan can run {PLANS[plan].concurrency} jobs at once and {PLANS[plan].takes} take per click.
      </p>
      <div className="row">
        <label>
          Video size
          <select value={resolution} onChange={(event) => setResolution(event.target.value as "480p" | "720p")}>
            <option value="480p">480p draft, default</option>
            <option value="720p">720p finish, higher price</option>
          </select>
        </label>
        <a className="btn-ghost small" href={`/api/projects/${data.project.id}/export`}>Download zip</a>
        <button className="btn-ghost small" type="button" onClick={() => void assemble()}>Build silent cut</button>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {note ? <p className="panel">{note}</p> : null}
      <div className="shot-grid">
        <div>
          {data.scenes.map((scene) => (
            <section key={scene.id}>
              <h2>{scene.heading}</h2>
              <p className="muted">{scene.summary}</p>
              {scene.shots.map((shot) => {
                const videoQuote = resolution === "720p" ? shot.quotes.video720 : shot.quotes.video480;
                return (
                  <form
                    key={shot.id}
                    className="shot"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveShot(shot, new FormData(event.currentTarget));
                    }}
                  >
                    <strong>Shot {shot.position + 1}</strong>
                    <label>
                      Action
                      <textarea name="action" defaultValue={shot.action} required />
                    </label>
                    <div className="row">
                      <label>Size<input name="size" defaultValue={shot.size} required /></label>
                      <label>Angle<input name="angle" defaultValue={shot.angle} required /></label>
                      <label>Move<input name="movement" defaultValue={shot.movement} required /></label>
                    </div>
                    <div className="row">
                      <label>Lens<input name="lens" defaultValue={shot.lens} required /></label>
                      <label>Focus<input name="focus" defaultValue={shot.focus} required /></label>
                      <label>Mood<input name="mood" defaultValue={shot.mood} required /></label>
                    </div>
                    <label>Lighting<input name="lighting" defaultValue={shot.lighting} required /></label>
                    <div className="row">
                      <label>Seconds<input name="durationSec" type="number" min={1} max={60} defaultValue={shot.durationSec} required /></label>
                      <label>Sound note<input name="soundNote" defaultValue={shot.soundNote} /></label>
                    </div>
                    <p className="muted">
                      Still {formatCredits(shot.quotes.still)} credits. Video {formatCredits(videoQuote)} credits at {resolution}. Video generation uses at most 10 seconds.
                    </p>
                    <div className="row">
                      {data.elements.map((element) => (
                        <label key={element.id} className="chip">
                          <input
                            type="checkbox"
                            checked={shot.elementIds.includes(element.id)}
                            onChange={(event) => void toggleLink(shot.id, element.id, event.target.checked)}
                          />
                          {element.name}
                        </label>
                      ))}
                    </div>
                    <div className="row">
                      <button className="btn-ghost small" type="submit">Save shot</button>
                      <button className="btn small" type="button" onClick={() => void generate(shot, "still")}>
                        Generate still, {formatCredits(shot.quotes.still)}
                      </button>
                      <button className="btn small" type="button" onClick={() => void generate(shot, "video")}>
                        Generate {resolution}, {formatCredits(videoQuote)}
                      </button>
                    </div>
                  </form>
                );
              })}
            </section>
          ))}
        </div>
        <aside>
          <div className="panel">
            <h2>References</h2>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                void addElement(new FormData(event.currentTarget));
                event.currentTarget.reset();
              }}
            >
              <label>
                Kind
                <select name="kind" defaultValue="character">
                  <option value="character">character</option>
                  <option value="location">location</option>
                  <option value="prop">prop</option>
                </select>
              </label>
              <label>Name<input name="name" required maxLength={80} /></label>
              <label>Notes<input name="notes" maxLength={400} /></label>
              <button className="btn small" type="submit">Add reference</button>
            </form>
            <ul>
              {data.elements.map((element) => (
                <li key={element.id}>
                  {element.kind}: {element.name} ({element.assetIds.length}/8)
                </li>
              ))}
            </ul>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                void upload(new FormData(event.currentTarget));
                event.currentTarget.reset();
              }}
            >
              <label>
                Attach an image to
                <select name="elementId">
                  <option value="">No element yet</option>
                  {data.elements.map((element) => (
                    <option key={element.id} value={element.id}>{element.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Image file
                <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
              </label>
              <button className="btn-ghost small" type="submit">Upload</button>
            </form>
            <div className="row">
              {data.assets.filter((asset) => asset.mime.startsWith("image/")).map((asset) => (
                // Session-gated file. The image optimizer would request it without the cookie.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={asset.id}
                  className="thumb"
                  alt="Reference upload"
                  width={asset.width ?? 120}
                  height={asset.height ?? 68}
                  src={`/api/assets/${asset.id}`}
                />
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Jobs</h2>
            {data.jobs.length === 0 ? <p className="muted">No jobs yet. Approve a price on a shot.</p> : null}
            <ul>
              {data.jobs.map((job) => (
                <li key={job.id}>
                  <span className="chip">{job.status}</span> {job.kind} {job.resolution}{" "}
                  {job.output_asset_id ? <a href={`/api/assets/${job.output_asset_id}?download=1`}>Download</a> : null}
                  {job.error ? <span className="warn"> {job.error}</span> : null}
                  {data.integrations.canPublish && job.output_asset_id ? (
                    <span className="row">
                      <button type="button" className="btn-ghost small" onClick={() => void publish(job.output_asset_id as string, "drive")}>Drive</button>
                      <button type="button" className="btn-ghost small" onClick={() => void publish(job.output_asset_id as string, "dropbox")}>Dropbox</button>
                      <button type="button" className="btn-ghost small" onClick={() => void publish(job.output_asset_id as string, "social")}>Social</button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {data.integrations.canPublish ? (
              <p className="muted">{data.integrations.configured ? "Publishing uses your Composio tools and does not spend generation credits." : "Publishing tools are not configured on this server. Download still works."}</p>
            ) : (
              <p className="muted">Drive, Dropbox, and social publishing are on Maker and Studio. Download is included on every plan.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
