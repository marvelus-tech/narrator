export type Look = {
  filmStock: string;
  grade: string;
  lensFamily: string;
  lighting: string;
};

export type PlannedShot = {
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
};

export type PlannedScene = {
  heading: string;
  summary: string;
  shots: PlannedShot[];
};

const SIZES = ["wide", "medium", "close", "insert", "medium", "wide"];
const ANGLES = ["eye level", "low", "eye level", "high", "eye level", "eye level"];
const MOVES = ["static", "push in", "pan", "static", "track", "static"];
const HEADINGS = ["Opening", "Action", "Button"];

// Same scripted planner the server uses when no model is configured. No network, no credits.
export function planBrief(brief: string, look: Look): { title: string; scenes: PlannedScene[] } {
  const clean = brief.replace(/\s+/g, " ").trim();
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  const beats =
    sentences.length >= 4
      ? sentences.slice(0, 6)
      : [
          `Wide view that establishes the world of this brief: ${clean}`,
          `Introduce the main subject: ${clean}`,
          `Show the action clearly: ${clean}`,
          `Cut to a detail from the same moment: ${clean}`,
          `Show the consequence of that action: ${clean}`,
          `Hold on a closing image: ${clean}`,
        ];
  const shots: PlannedShot[] = beats.map((action, index) => ({
    action,
    size: SIZES[index % SIZES.length] ?? "medium",
    angle: ANGLES[index % ANGLES.length] ?? "eye level",
    movement: MOVES[index % MOVES.length] ?? "static",
    lens: look.lensFamily,
    focus: index % 2 === 0 ? "deep" : "shallow",
    lighting: look.lighting,
    mood: look.grade,
    durationSec: 5,
    soundNote: "",
  }));
  const scenes: PlannedScene[] = [];
  for (let i = 0; i < shots.length; i += 2) {
    const group = shots.slice(i, i + 2);
    const heading = HEADINGS[scenes.length] ?? `Scene ${scenes.length + 1}`;
    scenes.push({
      heading,
      summary: group[0]?.action.slice(0, 140) ?? heading,
      shots: group,
    });
  }
  const title = clean.split(" ").slice(0, 8).join(" ").slice(0, 80) || "Untitled brief";
  return { title, scenes };
}
