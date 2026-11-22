"use client";

import { useEffect, useRef, useState } from "react";
import { zipSync } from "fflate";
import { UpgradeModal } from "@/components/upgrade-modal";
import { directBrief, type DirectorShot } from "@/shared/director";
import { formatCredits, quoteStill, quoteVideo } from "@/shared/economy";
import { clearPending, readPending, type PendingPrompt } from "@/shared/pending-prompt";

type Card = DirectorShot & { id: string; still: string | null; video: string | null; resolution: "480p" | "720p" };

const PREVIEW_KEY = "nr8r_preview_milli";
const START = 15_000;

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function paintFrame(canvas: HTMLCanvasElement, card: Card, prompt: string, t: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const hue = hash(prompt + card.lens) % 360;
  const slide = card.movement === "#pan-right" || card.movement === "#tracking" ? t * w * 0.2 : card.movement === "#dolly-in" ? t * 48 : Math.sin(t * 8) * 8;
  const lift = card.movement === "#crane-up" ? (1 - t) * 40 : 0;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, `hsl(${hue} 42% 10%)`);
  gradient.addColorStop(1, "#000000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d1fe17";
  ctx.fillRect(0, 0, w, 8);
  ctx.fillStyle = "rgba(209,254,23,0.22)";
  ctx.fillRect(48 + slide, h * 0.32 + lift, w * 0.26, h * 0.38);
  ctx.fillStyle = "#ff5000";
  ctx.font = "700 18px sans-serif";
  ctx.fillText("REC", w - 72, 36);
  ctx.fillStyle = "#f4f6f8";
  ctx.font = "600 32px Arial Narrow, Impact, sans-serif";
  ctx.fillText("Nr8tr", 24, 48);
  ctx.font = "16px sans-serif";
  ctx.fillText(`${card.lens}  ${card.movement}`, 24, h - 28);
}

function readCredits(): number {
  const raw = Number(localStorage.getItem(PREVIEW_KEY));
  return Number.isFinite(raw) && raw >= 0 ? raw : START;
}

export function StaticStudioPreview() {
  const [prompt, setPrompt] = useState("A courier runs a sealed letter through a flooded street at night.");
  const [aspect, setAspect] = useState<PendingPrompt["aspect"]>("2.39:1");
  const [count, setCount] = useState(5);
  const [cards, setCards] = useState<Card[]>([]);
  const [credits, setCredits] = useState(START);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [reel, setReel] = useState<string[]>([]);
  const canvases = useRef<Record<string, HTMLCanvasElement | null>>({});
  const started = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCredits(readCredits());
      const pending = readPending();
      const params = new URLSearchParams(window.location.search);
      if (!pending || params.get("autorun") !== "1" || started.current) return;
      started.current = true;
      setPrompt(pending.prompt);
      setAspect(pending.aspect);
      setCount(pending.count);
      plan(pending.prompt, pending.aspect, pending.count);
      clearPending();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    for (const card of cards) {
      const canvas = canvases.current[card.id];
      if (canvas && !card.still && !card.video) paintFrame(canvas, card, prompt, 0);
    }
  }, [cards, prompt]);

  function plan(text: string, nextAspect: PendingPrompt["aspect"], nextCount: number) {
    const directed = directBrief(text, nextCount);
    setAspect(nextAspect);
    setCards(directed.shots.map((shot, index) => ({ ...shot, id: `s${index + 1}`, still: null, video: null, resolution: "480p" })));
    setError(null);
  }

  function spend(milli: number): boolean {
    const current = readCredits();
    if (current < milli) {
      setUpgrade(true);
      setError("Preview credits are short of that quote.");
      return false;
    }
    const next = current - milli;
    localStorage.setItem(PREVIEW_KEY, String(next));
    setCredits(next);
    return true;
  }

  function frame(card: Card) {
    const canvas = canvases.current[card.id];
    if (!canvas) return;
    const milli = quoteStill().millicredits;
    if (!spend(milli)) return;
    paintFrame(canvas, card, prompt, 0.2);
    const still = canvas.toDataURL("image/png");
    setCards((current) => current.map((item) => (item.id === card.id ? { ...item, still } : item)));
  }

  async function roll(card: Card) {
    const canvas = canvases.current[card.id];
    if (!canvas || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record a preview clip.");
      return;
    }
    const milli = quoteVideo(card.resolution, card.durationSec).millicredits;
    if (!spend(milli)) return;
    const stream = canvas.captureStream(12);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    recorder.start();
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / (card.durationSec * 1000));
        paintFrame(canvas, card, prompt, t);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    recorder.stop();
    const blob = await stopped;
    const url = URL.createObjectURL(blob);
    setCards((current) => current.map((item) => (item.id === card.id ? { ...item, video: url } : item)));
  }

  function downloadPack() {
    const files: Record<string, Uint8Array> = {};
    for (const card of cards) {
      if (!card.still) continue;
      const b64 = card.still.split(",")[1] ?? "";
      files[`nr8tr-${card.id}.png`] = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
    }
    if (Object.keys(files).length === 0) {
      setError("Generate a frame before the shot pack.");
      return;
    }
    const zipped = zipSync(files);
    const blob = new Blob([zipped], { type: "application/zip" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `nr8tr-${Date.now().toString(36)}.zip`;
    link.click();
  }

  const ratio = aspect === "9:16" ? "frame-9x16" : aspect === "16:9" ? "frame-16x9" : "";

  return (
    <div className="studio">
      <div className="studio-top">
        <div>
          <p className="kicker">Preview studio</p>
          <h1>Direct in this browser</h1>
        </div>
        <button className="credit-pill" type="button" onClick={() => setUpgrade(true)}>{formatCredits(credits)} cr</button>
      </div>
      <form className="prompt-box" onSubmit={(event) => { event.preventDefault(); plan(prompt.trim(), aspect, count); }}>
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
          <button className="btn" type="submit">Plan the film</button>
          <button className="btn-ghost" type="button" onClick={() => {
            const urls = cards.map((card) => card.video).filter((url): url is string => Boolean(url));
            if (urls.length === 0) setError("Roll a video take first.");
            else setReel(urls);
          }}>Play Full Reel</button>
          <button className="btn-ghost" type="button" onClick={downloadPack}>Download Shot Pack</button>
        </div>
      </form>
      {reel[0] ? <video src={reel[0]} controls autoPlay playsInline /> : null}
      <div className="shot-board">
        {cards.map((card) => {
          const videoMilli = quoteVideo(card.resolution, card.durationSec).millicredits;
          return (
            <article key={card.id} className="shot-card">
              <div className="studio-toolbar">
                <strong>{card.lens}</strong>
                <span className="quote-badge">{formatCredits(quoteStill().millicredits)} cr still</span>
                <span className="quote-badge">{formatCredits(videoMilli)} cr {card.resolution}</span>
                <span className="cinema-rec">REC</span>
              </div>
              <canvas
                className={ratio}
                width={aspect === "9:16" ? 360 : aspect === "16:9" ? 640 : 956}
                height={aspect === "9:16" ? 640 : aspect === "16:9" ? 360 : 400}
                ref={(node) => { canvases.current[card.id] = node; }}
              />
              {card.video ? <video src={card.video} controls playsInline /> : card.still ? (
                // Preview stills are canvas data URLs from this browser.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="frame" src={card.still} alt="" />
              ) : null}
              <p>{card.action}</p>
              <div className="studio-toolbar">
                <span className="chip">{card.movement}</span>
                <span className="chip">{card.durationSec}s</span>
                <button className="btn small" type="button" onClick={() => frame(card)}>Generate Frame</button>
                <button className="btn small" type="button" onClick={() => void roll(card)}>Roll Video Take</button>
              </div>
            </article>
          );
        })}
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} reason="Preview credits live in this browser. A paid plan runs on the Nr8tr server." />
    </div>
  );
}
