// One short the landing monitor can cut between. Paths stay root-relative.
// Callers run them through publicAsset so a Pages build at /nr8tr still resolves.
// This lives in shared/, not src/data: the gitignore name "data" ignores every such folder.
import type { Resolution } from "@/shared/economy";

export const SHOWCASE_STILL = { width: 1200, height: 502 } as const;
export const SHOWCASE_CAST = { width: 480, height: 640 } as const;

export type ShowcaseRef = {
  id: string;
  label: string;
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type ShowcaseShot = {
  id: string;
  slate: string;
  move: string;
  lens: string;
  stop: string;
  timecode: string;
  still: string;
  loop: string;
  alt: string;
  prompt: string;
  resolution: Resolution;
  // Quote the product unit (a 5 second take), not the 3 second preview loop.
  seconds: number;
};

export type ShowcaseGrammar = {
  shotId: string;
  title: string;
  note: string;
};

export const SHOWCASE_FILM = {
  brief: "A courier carries a sealed letter through floodwater to an all-night diner.",
  fps: 24,
  refs: [
    {
      id: "cast-a",
      label: "CAST A · LEAD",
      src: "/showcase/cast-01.webp",
      width: SHOWCASE_CAST.width,
      height: SHOWCASE_CAST.height,
      alt: "Lead reference. Courier in a wet coat, rain on her face.",
    },
    {
      id: "set-b",
      label: "SET B · DINER",
      src: "/showcase/loc-01.webp",
      width: SHOWCASE_STILL.width,
      height: SHOWCASE_STILL.height,
      alt: "Set reference. All-night diner glowing on the flooded street.",
    },
  ] satisfies ShowcaseRef[],
  shots: [
    {
      id: "01A",
      slate: "01A ESTABLISHING",
      move: "DOLLY IN",
      lens: "50MM PRIME",
      stop: "T1.4",
      timecode: "00:00:03:14",
      still: "/showcase/shot-01.webp",
      loop: "/showcase/move-01.mp4",
      alt: "Establishing view of the courier walking a flooded street at night",
      prompt: "Dolly in on a courier walking away down a flooded street at night.",
      resolution: "480p",
      seconds: 5,
    },
    {
      id: "02A",
      slate: "02A CLOSE-UP",
      move: "HANDHELD",
      lens: "50MM PRIME",
      stop: "T1.4",
      timecode: "00:00:07:08",
      still: "/showcase/shot-02.webp",
      loop: "/showcase/move-02.mp4",
      alt: "Close-up of the courier standing in floodwater under sodium lamps",
      prompt: "Handheld close-up as she stands in the floodwater under sodium lamps.",
      resolution: "480p",
      seconds: 5,
    },
    {
      id: "03A",
      slate: "03A TRACKING",
      move: "TRACK LEFT",
      lens: "35MM ANAMORPHIC",
      stop: "T2.0",
      timecode: "00:00:11:02",
      still: "/showcase/shot-03.webp",
      loop: "/showcase/move-03.mp4",
      alt: "Hands holding a sealed letter above dark floodwater",
      prompt: "Track left across her hands holding a sealed letter above the water.",
      resolution: "480p",
      seconds: 5,
    },
    {
      id: "04A",
      slate: "04A REVERSE",
      move: "CRANE UP",
      lens: "24MM WIDE",
      stop: "T2.0",
      timecode: "00:00:15:16",
      still: "/showcase/shot-04.webp",
      loop: "/showcase/move-04.mp4",
      alt: "Reverse angle of the courier in a stone doorway with the letter",
      prompt: "Crane up from a stone doorway as she waits with the letter.",
      resolution: "720p",
      seconds: 5,
    },
  ] satisfies ShowcaseShot[],
};

// Three grammar cards. Titles stay on the plan's lens lines. The shot id
// is what the price follows, so 04A can show the higher 720p quote.
export const SHOWCASE_GRAMMAR = [
  {
    shotId: "01A",
    title: "DOLLY IN · 50MM T1.4",
    note: "Camera moves closer. This is the default 5 second 480p quote.",
  },
  {
    shotId: "03A",
    title: "TRACKING · 35MM ANAMORPHIC",
    note: "Camera travels with the letter. Same 5 second 480p quote.",
  },
  {
    shotId: "04A",
    title: "CRANE WIDE · 24MM T2.0",
    note: "Camera rises off the doorway. 720p is the higher quote you choose on purpose.",
  },
] satisfies ShowcaseGrammar[];

export const PIPELINE_FRAMES = [
  { src: SHOWCASE_FILM.shots[0].still, alt: SHOWCASE_FILM.shots[0].alt, ...SHOWCASE_STILL },
  { src: SHOWCASE_FILM.refs[0].src, alt: SHOWCASE_FILM.refs[0].alt, ...SHOWCASE_CAST },
  { src: SHOWCASE_FILM.shots[2].still, alt: SHOWCASE_FILM.shots[2].alt, ...SHOWCASE_STILL },
  { src: SHOWCASE_FILM.shots[3].still, alt: SHOWCASE_FILM.shots[3].alt, ...SHOWCASE_STILL },
] as const;
