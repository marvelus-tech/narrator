import type { Look } from "./planner";

export type ShotPromptInput = {
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

export function composePrompt(input: {
  look: Look;
  aspect: string;
  shot: ShotPromptInput;
  elements: { kind: string; name: string }[];
}): string {
  const { look, shot } = input;
  const refs = input.elements.map((item) => `${item.kind} ${item.name}`).join(", ");
  return [
    `Look: ${look.filmStock}, grade ${look.grade}, lens family ${look.lensFamily}, lighting ${look.lighting}.`,
    `Shot: ${shot.size}, ${shot.angle}, ${shot.movement}, lens ${shot.lens}, focus ${shot.focus}.`,
    `Mood: ${shot.mood}. Lighting: ${shot.lighting}.`,
    `Action: ${shot.action}`,
    refs ? `References: ${refs}.` : "",
    `Duration: ${shot.durationSec} seconds. Aspect: ${input.aspect}.`,
    shot.soundNote ? `Sound note: ${shot.soundNote}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
