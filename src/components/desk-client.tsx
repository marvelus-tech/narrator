"use client";

import { useEffect, useRef, useState } from "react";
import { UpgradeModal } from "@/components/upgrade-modal";
import { CAMERA_MOVES, LENSES } from "@/shared/director";
import { formatCredits } from "@/shared/economy";
import { followUrl } from "@/shared/api-base";
import { clearPending, readPending, savePending, type PendingPrompt } from "@/shared/pending-prompt";

type Shot = {
  id: string;
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
  quotes: { still: number; video480: number; video720: number };
};

type Job = { shot_id: string; kind: string; status: string; output_asset_id: string | null; error: string | null };

type Payload = {
  project: { id: string; title: string; brief: string; aspect: string };
  scenes: { heading: string; shots: Shot[] }[];
  elements: { id: string; kind: string; name: string }[];
  jobs: Job[];
  balance: { millicredits: number };
  plan: string;
  integrations: { canPublish: boolean };
};

type RemoteFile = { id: string; name: string };

const LOOK = { filmStock: "Kodak 250D", grade: "soft contrast", lensFamily: "anamorphic", lighting: "practical night" };

function shotsOf(payload: Payload): Shot[] {
  return payload.scenes.flatMap((scene) => scene.shots);
}

function latestAsset(jobs: Job[], shotId: string, kind: string): string | null {
  return jobs.find((job) => job.shot_id === shotId && job.kind === kind && job.status === "succeeded" && job.output_asset_id)?.output_asset_id ?? null;
}

export function DeskClient({
  verified,
  canPublish,
  startingBalance,
  initialProjectId,
}: {
  verified: boolean;
  canPublish: boolean;
  startingBalance: number;
  initialProjectId: string | null;
}) {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<PendingPrompt["aspect"]>("2.39:1");
  const [count, setCount] = useState(5);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [resolution, setResolution] = useState<Record<string, "480p" | "720p">>({});
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [importToolkit, setImportToolkit] = useState<"googledrive" | "dropbox">("googledrive");
  const [reel, setReel] = useState<string[]>([]);
  const [reelAt, setReelAt] = useState(0);
  const started = useRef(false);

  async function refresh(id: string) {
    const res = await fetch(`/api/projects/${id}`);
    const data = (await res.json()) as Payload & { message?: string };
    if (!res.ok) {
      setError(data.message ?? "The project could not be loaded.");
      return;
    }
    setPayload(data);
    setPrompt(data.project.brief);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const pending = readPending();
      if (pending) {
        setPrompt(pending.prompt);
        setAspect(pending.aspect);
        setCount(pending.count);
      }
      if (params.get("autorun") === "1" && pending && !started.current) {
        started.current = true;
        void createFrom(pending);
        return;
      }
      if (initialProjectId) void refresh(initialProjectId);
    }, 0);
    return () => window.clearTimeout(timer);
    // Autorun reads the queued prompt once. The planner function is the first-render copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!payload) return;
    const running = payload.jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!running) return;
    const timer = window.setTimeout(() => void refresh(payload.project.id), 1200);
    return () => window.clearTimeout(timer);
  }, [payload]);

  async function createFrom(pending: PendingPrompt) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: pending.prompt, aspect: pending.aspect, shotCount: pending.count, useModel: true, look: LOOK }),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    setBusy(false);
    if (!res.ok || !data.id) {
      setError(data.message ?? "The brief could not be planned.");
      return;
    }
    clearPending();
    await refresh(data.id);
  }

  async function patch(shot: Shot, next: Partial<Shot>) {
    if (!payload) return;
    const merged = { ...shot, ...next };
    const res = await fetch(`/api/shots/${shot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: merged.action,
        size: merged.size,
        angle: merged.angle,
        movement: merged.movement,
        lens: merged.lens,
        focus: merged.focus,
        lighting: merged.lighting,
        mood: merged.mood,
        durationSec: merged.durationSec,
        soundNote: merged.soundNote || "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      setError(data.message ?? "The shot could not be saved.");
      return;
    }
    await refresh(payload.project.id);
  }

  function videoMilli(shot: Shot): number {
    return (resolution[shot.id] ?? "480p") === "720p" ? shot.quotes.video720 : shot.quotes.video480;
  }

  async function generate(shot: Shot, kind: "still" | "video") {
    if (!payload) return;
    const milli = kind === "still" ? shot.quotes.still : videoMilli(shot);
    if (payload.balance.millicredits < milli) {
      setUpgrade(true);
      return;
    }
    setError(null);
    const res = await fetch(`/api/shots/${shot.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        resolution: kind === "still" ? "480p" : (resolution[shot.id] ?? "480p"),
        takes: 1,
        confirm: true,
        expectedMillicredits: milli,
        requestId: crypto.randomUUID(),
      }),
    });
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      if (data.error === "insufficient_credits") setUpgrade(true);
      setError(data.message ?? "Generation did not start.");
      return;
    }
    await refresh(payload.project.id);
  }

  async function download() {
    if (!payload) return;
    const cut = await fetch(`/api/projects/${payload.project.id}/assemble`, { method: "POST" });
    if (cut.ok) {
      const body = (await cut.json()) as { assetId?: string };
      if (body.assetId) {
        followUrl(`/api/assets/${body.assetId}?download=1`);
        return;
      }
    }
    followUrl(`/api/projects/${payload.project.id}/export`);
  }

  async function publish(toolkit: string) {
    if (!payload) return;
    const asset = payload.jobs.find((job) => job.status === "succeeded" && job.output_asset_id);
    if (!asset?.output_asset_id) {
      setError("Generate a frame or a clip before you publish.");
      return;
    }
    const res = await fetch(`/api/projects/${payload.project.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolkit, assetId: asset.output_asset_id }),
    });
    const data = (await res.json()) as { message?: string; upgrade?: boolean };
    if (data.upgrade) setUpgrade(true);
    setError(data.message ?? (res.ok ? "Sent to the connected toolkit." : "Publish did not complete."));
  }

  async function listRemote(toolkit: "googledrive" | "dropbox") {
    if (!payload) return;
    setImportToolkit(toolkit);
    const res = await fetch(`/api/integrations/import?toolkit=${toolkit}&projectId=${payload.project.id}`);
    const data = (await res.json()) as { files?: RemoteFile[]; message?: string };
    setFiles(data.files ?? []);
    if (!res.ok) setError(data.message ?? "Import is not connected yet.");
    else if ((data.files ?? []).length === 0) setError("No images yet. Connect Drive or Dropbox on the stack page, then try again.");
  }

  async function importFile(file: RemoteFile) {
    if (!payload) return;
    const res = await fetch("/api/integrations/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolkit: importToolkit, projectId: payload.project.id, fileId: file.id, name: file.name, kind: "character" }),
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) setError(data.message ?? "That file could not be imported.");
    else await refresh(payload.project.id);
  }

  async function upload(file: File) {
    if (!payload) return;
    const body = new FormData();
    body.set("projectId", payload.project.id);
    body.set("file", file);
    const res = await fetch("/api/assets", { method: "POST", body });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) setError(data.message ?? "Upload failed.");
    else await refresh(payload.project.id);
  }

  const shots = payload ? shotsOf(payload) : [];
  const social = canPublish || payload?.integrations.canPublish;

  return (
    <div className="studio">
      <div className="studio-top">
        <div>
          <p className="kicker">Studio</p>
          <h1>{payload?.project.title ?? "Direct a prompt"}</h1>
        </div>
        <button className="credit-pill" type="button" onClick={() => setUpgrade(true)}>
          {formatCredits(payload?.balance.millicredits ?? startingBalance)} cr
        </button>
      </div>
      {verified ? null : <p className="warn">Verify email before the first generation. The signup page shows the link when mail is not configured.</p>}
      <form
        className="prompt-box"
        onSubmit={(event) => {
          event.preventDefault();
          const next = { prompt: prompt.trim(), aspect, count };
          savePending(next);
          void createFrom(next);
        }}
      >
        <label>
          Prompt
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={12} required />
        </label>
        <div className="studio-toolbar">
          <select value={aspect} onChange={(event) => setAspect(event.target.value as PendingPrompt["aspect"])}>
            <option>2.39:1</option>
            <option>16:9</option>
            <option>9:16</option>
          </select>
          <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
            <option value={4}>4 shots</option>
            <option value={5}>5 shots</option>
            <option value={6}>6 shots</option>
          </select>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Planning" : "Plan the film"}</button>
        </div>
      </form>
      {payload ? (
        <>
          <p className="muted">{payload.elements.map((item) => `${item.kind}: ${item.name}`).join(" · ") || "No cast yet."}</p>
          <div className="studio-toolbar">
            <label>
              Reference
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }} />
            </label>
            <button className="btn-ghost small" type="button" onClick={() => void listRemote("googledrive")}>Import Drive</button>
            <button className="btn-ghost small" type="button" onClick={() => void listRemote("dropbox")}>Import Dropbox</button>
            <button className="btn-ghost small" type="button" onClick={() => {
              const urls = shots.map((shot) => latestAsset(payload.jobs, shot.id, "video")).filter((id): id is string => Boolean(id)).map((id) => `/api/assets/${id}`);
              if (urls.length === 0) setError("Roll a video take first.");
              else { setReel(urls); setReelAt(0); }
            }}>Play Full Reel</button>
            <button className="btn-ghost small" type="button" onClick={() => void download()}>Download Cut / Shot Pack</button>
            <button className="btn-ghost small" type="button" onClick={() => void publish("googledrive")}>Save to Drive</button>
            <button className="btn-ghost small" type="button" onClick={() => void publish("dropbox")}>Save to Dropbox</button>
            {social ? (
              <>
                <button className="btn-ghost small" type="button" onClick={() => void publish("youtube")}>YouTube</button>
                <button className="btn-ghost small" type="button" onClick={() => void publish("twitter")}>X</button>
                <button className="btn-ghost small" type="button" onClick={() => void publish("tiktok")}>TikTok</button>
              </>
            ) : (
              <button className="btn small" type="button" onClick={() => setUpgrade(true)}>Upgrade to publish social</button>
            )}
          </div>
          {files.length > 0 ? (
            <div className="row">
              {files.map((file) => (
                <button key={file.id} className="chip" type="button" onClick={() => void importFile(file)}>{file.name}</button>
              ))}
            </div>
          ) : null}
          {reel.length > 0 ? (
            <video
              className="frame"
              src={reel[reelAt]}
              controls
              autoPlay
              playsInline
              onEnded={() => setReelAt((index) => Math.min(reel.length - 1, index + 1))}
            />
          ) : null}
          <div className="shot-board">
            {shots.map((shot, index) => {
              const still = latestAsset(payload.jobs, shot.id, "still");
              const video = latestAsset(payload.jobs, shot.id, "video");
              const res = resolution[shot.id] ?? "480p";
              return (
                <article key={shot.id} className="shot-card">
                  <div className="studio-toolbar">
                    <strong>Shot {index + 1}</strong>
                    <span className="quote-badge">{formatCredits(shot.quotes.still)} cr still</span>
                    <span className="quote-badge">{formatCredits(res === "720p" ? shot.quotes.video720 : shot.quotes.video480)} cr {res}</span>
                    <span className="cinema-rec">REC</span>
                  </div>
                  {payload.jobs.find((job) => job.shot_id === shot.id && job.status === "failed") ? (
                    <p className="warn">{payload.jobs.find((job) => job.shot_id === shot.id && job.status === "failed")?.error}</p>
                  ) : null}
                  {video ? <video src={`/api/assets/${video}`} controls playsInline /> : still ? (
                    // Generated frames are authenticated same-origin bytes, not static files.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="frame" src={`/api/assets/${still}`} alt="" />
                  ) : <div className="cinema-screen" />}
                  <textarea value={shot.action} onChange={(event) => {
                    const action = event.target.value;
                    setPayload((current) => current && ({
                      ...current,
                      scenes: current.scenes.map((scene) => ({
                        ...scene,
                        shots: scene.shots.map((item) => item.id === shot.id ? { ...item, action } : item),
                      })),
                    }));
                  }} onBlur={(event) => void patch(shot, { action: event.target.value })} />
                  <div className="studio-toolbar">
                    <select value={shot.lens} onChange={(event) => void patch(shot, { lens: event.target.value })}>
                      {LENSES.map((lens) => <option key={lens}>{lens}</option>)}
                    </select>
                    <select value={shot.movement} onChange={(event) => void patch(shot, { movement: event.target.value })}>
                      {CAMERA_MOVES.map((move) => <option key={move}>{move}</option>)}
                    </select>
                    <select value={String(shot.durationSec)} onChange={(event) => void patch(shot, { durationSec: Number(event.target.value) })}>
                      <option value="5">5s</option>
                      <option value="10">10s</option>
                    </select>
                    <select value={res} onChange={(event) => setResolution((current) => ({ ...current, [shot.id]: event.target.value as "480p" | "720p" }))}>
                      <option value="480p">480p</option>
                      <option value="720p">720p</option>
                    </select>
                    <button className="btn small" type="button" onClick={() => void generate(shot, "still")}>Generate Frame</button>
                    <button className="btn small" type="button" onClick={() => void generate(shot, "video")}>Roll Video Take</button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} reason={error ?? undefined} />
    </div>
  );
}
