"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { creditExamples, landing } from "@/shared/content";
import { routes } from "@/shared/routes";

const shots = [
  {
    id: "01A",
    move: "#dolly-in",
    src: "/showcase/shot-01.webp",
    alt: "Wide view of a courier in a wet street at dusk",
  },
  {
    id: "02A",
    move: "#tracking",
    src: "/showcase/shot-02.webp",
    alt: "Courier standing in floodwater under sodium lamps",
  },
  {
    id: "03A",
    move: "#lock-off",
    src: "/showcase/shot-03.webp",
    alt: "Hands holding a sealed envelope above dark water",
  },
  {
    id: "04A",
    move: "#pan-right",
    src: "/showcase/shot-04.webp",
    alt: "Courier in a stone doorway with the envelope",
  },
] as const;

const moves = ["#dolly-in", "#tracking", "#pan-right", "#lock-off"] as const;
const assetBase = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function CinemaHero() {
  const draft = creditExamples[1];
  const [motion, setMotion] = useState<"unknown" | "ok" | "reduce">("unknown");
  const [active, setActive] = useState(0);
  const shot = shots[active];
  const playMove = motion === "ok" && active === 0;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(query.matches ? "reduce" : "ok");
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <section className="cinema-hero" aria-labelledby="cinema-title">
      <div className="cinema-copy">
        <p className="kicker">{landing.kicker}</p>
        <h1 id="cinema-title">{landing.title}</h1>
        <p className="lede">{landing.lede}</p>
        <div className="actions">
          <Link className="btn" href={routes.signup}>
            Start a brief
          </Link>
          <Link className="btn-ghost" href={routes.pricing}>
            See pricing
          </Link>
        </div>
      </div>
      <div className="cinema-stage">
        <div className="cinema-pins">
          <figure>
            <Image src="/showcase/cast-01.webp" alt="Courier reference portrait" width={480} height={640} />
            <figcaption>CAST 01</figcaption>
          </figure>
          <figure>
            <Image src="/showcase/loc-01.webp" alt="Flooded street location reference" width={1200} height={502} />
            <figcaption>CAST 02</figcaption>
          </figure>
        </div>
        <div className="cinema-monitor" role="region" aria-label="Direction monitor">
          <div className="cinema-readout">
            <span className="cinema-rec">REC 00:00:05:00 · 24 FPS</span>
            <span className="cinema-quote">
              {draft.credits} cr · {draft.dollars}
            </span>
          </div>
          <div className="cinema-screen">
            <Image src={shot.src} alt={shot.alt} fill sizes="(max-width: 860px) 100vw, 760px" priority={active === 0} />
            {playMove ? (
              <video
                className="cinema-video"
                src={`${assetBase}/showcase/move-preview.mp4`}
                poster={`${assetBase}/showcase/shot-01.webp`}
                muted
                playsInline
                autoPlay
                loop
                preload="metadata"
                aria-label="Muted five second dolly in on the wet street"
              />
            ) : null}
            <span className="cinema-bracket tl" />
            <span className="cinema-bracket tr" />
            <span className="cinema-bracket bl" />
            <span className="cinema-bracket br" />
            <span className="cinema-cross" aria-hidden="true" />
          </div>
          <div className="cinema-chips">
            <span className="cinema-chip cinema-chip-lens">35MM ANAMORPHIC · T2.0</span>
            {moves.map((move) => {
              const index = shots.findIndex((item) => item.move === move);
              const pressed = active === index;
              return (
                <button
                  key={move}
                  type="button"
                  className="cinema-chip"
                  aria-pressed={pressed}
                  onClick={() => setActive(index)}
                >
                  {move}
                </button>
              );
            })}
          </div>
          <div className="cinema-strip" role="tablist" aria-label="Shot frames">
            {shots.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="cinema-sprocket"
                role="tab"
                aria-selected={active === index}
                onClick={() => setActive(index)}
              >
                <span className="cinema-holes" aria-hidden="true" />
                <span className="cinema-cell">
                  <Image src={item.src} alt="" width={1200} height={502} />
                  <span>{item.id}</span>
                </span>
                <span className="cinema-holes" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
