"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeroPromptComposer } from "@/components/hero-prompt-composer";
import { SHOWCASE_FILM, SHOWCASE_STILL } from "@/shared/showcase-film";
import { landing } from "@/shared/content";
import { formatCreditUsd, formatCredits, quoteVideo } from "@/shared/economy";
import { publicAsset } from "@/shared/public-asset";
import { routes } from "@/shared/routes";

const cutMs = 3200;

export function CinemaHero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState<"unknown" | "ok" | "reduce">("unknown");
  const [active, setActive] = useState(0);
  const [thirds, setThirds] = useState(false);
  const [cut, setCut] = useState(false);
  const shot = SHOWCASE_FILM.shots[active];
  const quote = quoteVideo(shot.resolution, shot.seconds);
  const price = `${formatCredits(quote.millicredits)} cr · ${formatCreditUsd(quote.millicredits)}`;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(query.matches ? "reduce" : "ok");
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!cut) return;
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % SHOWCASE_FILM.shots.length);
    }, cutMs);
    return () => window.clearInterval(timer);
  }, [cut]);

  function selectShot(index: number) {
    setCut(false);
    setActive(index);
  }

  function toggleCut() {
    const next = !cut;
    if (next) {
      setActive(0);
      stageRef.current?.scrollIntoView({ behavior: motion === "ok" ? "smooth" : "auto", block: "center" });
    }
    setCut(next);
  }

  return (
    <section className="cinema-hero" aria-labelledby="cinema-title">
      <div className="cinema-copy">
        <p className="kicker">{landing.kicker}</p>
        <h1 id="cinema-title">{landing.title}</h1>
        <p className="lede">{landing.lede}</p>
      </div>
      <div className="actions cinema-try">
        <Link className="btn" href={routes.signup}>Direct your first scene</Link>
        <button type="button" className="btn-ghost" aria-pressed={cut} aria-controls="director-monitor" onClick={toggleCut}>
          {cut ? "Pause 4-shot cut" : "Play 4-shot cut"}
        </button>
      </div>
      <p className="cinema-free">15 free credits, no card</p>
      <HeroPromptComposer />
      <div className="cinema-stage" ref={stageRef}>
        <div className="cinema-monitor" id="director-monitor" role="region" aria-label="Direction monitor">
          <div className="cinema-readout">
            <span className="cinema-rec">TC {shot.timecode} · {SHOWCASE_FILM.fps} FPS · {shot.resolution}</span>
            <span className="cinema-quote">{price}</span>
          </div>
          <div className="cinema-screen" data-ratio="2.39:1">
            <Image
              src={publicAsset(shot.still)}
              alt={shot.alt}
              width={SHOWCASE_STILL.width}
              height={SHOWCASE_STILL.height}
              sizes="(max-width: 860px) 100vw, 860px"
              priority={active === 0}
            />
            {motion === "ok" ? (
              <video
                key={shot.loop}
                className="cinema-video"
                src={publicAsset(shot.loop)}
                poster={publicAsset(shot.still)}
                muted
                playsInline
                autoPlay
                loop
                preload="metadata"
                aria-hidden="true"
              />
            ) : null}
            {thirds ? <span className="cinema-thirds" aria-hidden="true" /> : <span className="cinema-cross" aria-hidden="true" />}
            <span className="cinema-bracket tl" />
            <span className="cinema-bracket tr" />
            <span className="cinema-bracket bl" />
            <span className="cinema-bracket br" />
          </div>
          <div className="cinema-chips">
            <span className="cinema-chip cinema-chip-lens">{shot.lens} · {shot.stop}</span>
            {SHOWCASE_FILM.shots.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="cinema-chip"
                aria-pressed={active === index}
                onClick={() => selectShot(index)}
              >
                {item.move}
              </button>
            ))}
            <button type="button" className="cinema-chip" aria-pressed={thirds} onClick={() => setThirds((on) => !on)}>
              THIRDS
            </button>
          </div>
          <div className="cinema-strip" role="tablist" aria-label="Shot frames">
            {SHOWCASE_FILM.shots.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="cinema-sprocket"
                role="tab"
                aria-selected={active === index}
                onClick={() => selectShot(index)}
              >
                <span className="cinema-holes" aria-hidden="true" />
                <span className="cinema-cell">
                  <Image src={publicAsset(item.still)} alt="" width={SHOWCASE_STILL.width} height={SHOWCASE_STILL.height} sizes="168px" />
                  <span>{item.slate}</span>
                </span>
                <span className="cinema-holes" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <aside className="cinema-pins" aria-label="Pinned references">
          {SHOWCASE_FILM.refs.map((ref) => (
            <figure key={ref.id}>
              <Image src={publicAsset(ref.src)} alt={ref.alt} width={ref.width} height={ref.height} sizes="156px" />
              <figcaption>{ref.label}</figcaption>
            </figure>
          ))}
        </aside>
      </div>
    </section>
  );
}
