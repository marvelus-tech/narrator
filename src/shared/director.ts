// Scene-aware shot parser used by the server and the static studio.
// No network. Lenses and moves stay inside the official NR8R lists.

export const LENSES = ["24mm Wide", "35mm Anamorphic", "50mm T1.4", "85mm Portrait"] as const;
export const CAMERA_MOVES = ["#dolly-in", "#tracking", "#pan-right", "#crane-up", "#handheld", "#lock-off"] as const;

export type LensName = (typeof LENSES)[number];
export type CameraMove = (typeof CAMERA_MOVES)[number];

export type DirectorShot = {
  action: string;
  size: string;
  angle: string;
  movement: CameraMove;
  lens: LensName;
  focus: string;
  lighting: string;
  mood: string;
  durationSec: number;
  soundNote: string;
};

export type DirectorRef = { name: string; notes: string };

export type DirectorPlan = {
  title: string;
  palette: string;
  lighting: string;
  cast: DirectorRef[];
  locations: DirectorRef[];
  shots: DirectorShot[];
};

const STOP = new Set(["a", "an", "the", "one", "when", "after", "before", "in", "on", "at", "and", "but", "she", "he", "they", "it"]);

const ROLES =
  /\b(courier|detective|woman|man|girl|boy|child|pilot|driver|doctor|queen|king|soldier|artist|singer|dancer|chef|captain|stranger|bride|groom|cat|dog|horse|robot|android|astronaut|thief|spy|nurse|teacher|kid|teen|mother|father|daughter|son|rider|guard|clerk|waiter|widow|ghost)\b/gi;

const PLACES =
  /\b(street|alley|kitchen|rooftop|desert|ocean|station|doorway|forest|bar|office|harbor|harbour|bridge|apartment|hallway|warehouse|beach|mountain|tunnel|diner|church|lab|spaceship|corridor|room|plaza|market|river|dock|pier|motel|castle|jungle|subway|train|bedroom|attic|cellar|courtyard|park|field|stage|hill|city|town|window|door|gate|road|lane|square|roof|sea|lake|cave|ship|boat|yard|porch|stairs|stair|water)\b/gi;

const LIGHTS: { test: RegExp; line: string; palette: string }[] = [
  { test: /golden hour|sunset|dusk|amber/i, line: "amber dusk, low sun, long shadows", palette: "amber and ink" },
  { test: /dawn|sunrise/i, line: "cold dawn, thin sun, blue shadow", palette: "steel blue" },
  { test: /neon|nightclub|cyber/i, line: "neon practicals, deep shadow", palette: "volt and magenta" },
  { test: /moon|midnight|night/i, line: "moonlight and cool practicals", palette: "silver and black" },
  { test: /rain|wet|storm|flood/i, line: "wet pavement, sodium spill", palette: "sodium and teal" },
  { test: /fog|mist|haze/i, line: "fog and soft backlight", palette: "grey pearl" },
  { test: /candle|firelight|torch|fire/i, line: "practical fire, warm falloff", palette: "ember" },
  { test: /overcast|grey|gray/i, line: "overcast soft top light", palette: "flat grey" },
  { test: /snow|ice|winter/i, line: "cold bounce, blue shadow", palette: "ice" },
  { test: /desert|noon|harsh sun/i, line: "hard sun, short shadows", palette: "bleached gold" },
];

const SIZES = ["wide", "medium", "close", "insert", "medium", "wide"];
const ANGLES = ["eye level", "low", "eye level", "high", "eye level", "slight high"];

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trim()}.`;
}

function uniquePush(list: string[], value: string) {
  const key = value.toLowerCase();
  if (!list.some((item) => item.toLowerCase() === key)) list.push(value);
}

export function extractCast(brief: string): DirectorRef[] {
  const found: string[] = [];
  const named = brief.matchAll(/\b(?:named|called)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g);
  for (const match of named) uniquePush(found, match[1] ?? "");
  const first = brief.trim().match(/^([A-Z][a-z]+)\b/);
  if (first && !STOP.has(first[1].toLowerCase())) uniquePush(found, first[1]);
  const roles = brief.match(ROLES) ?? [];
  for (const role of roles) uniquePush(found, titleCase(role));
  if (found.length === 0) found.push("Lead");
  return found.slice(0, 4).map((name) => ({
    name,
    notes: name === "Lead" ? "The subject of the brief" : "Pulled from the brief",
  }));
}

export function extractLocations(brief: string): DirectorRef[] {
  const found: string[] = [];
  const matches = brief.matchAll(PLACES);
  for (const match of matches) {
    const word = match[0] ?? "";
    const index = match.index ?? 0;
    const before = brief.slice(Math.max(0, index - 28), index);
    const adj = before.match(/([A-Za-z]{3,})\s+$/);
    const skip = adj ? STOP.has(adj[1].toLowerCase()) : true;
    const name = !skip && adj ? `${titleCase(adj[1])} ${word.toLowerCase()}` : titleCase(word);
    uniquePush(found, name);
  }
  if (found.length === 0) found.push("Open frame");
  return found.slice(0, 3).map((name) => ({
    name,
    notes: name === "Open frame" ? "No place was named, so the frame stays wide" : "Location pulled from the brief",
  }));
}

export function lightingFor(brief: string): { lighting: string; palette: string } {
  for (const row of LIGHTS) {
    if (row.test.test(brief)) return { lighting: row.line, palette: row.palette };
  }
  return { lighting: "motivated practicals, soft contrast", palette: "neutral film" };
}

function lensesFor(brief: string): LensName[] {
  const hits: LensName[] = [];
  if (/24\s?mm/i.test(brief)) hits.push("24mm Wide");
  if (/35\s?mm/i.test(brief)) hits.push("35mm Anamorphic");
  if (/50\s?mm/i.test(brief)) hits.push("50mm T1.4");
  if (/85\s?mm/i.test(brief)) hits.push("85mm Portrait");
  return hits.length > 0 ? hits : [...LENSES];
}

function movesFor(brief: string): CameraMove[] {
  const hits = CAMERA_MOVES.filter((move) => brief.toLowerCase().includes(move));
  return hits.length > 0 ? hits : [...CAMERA_MOVES];
}

function durationFor(brief: string): number {
  if (/\b10\s?(?:s|sec|second)/i.test(brief)) return 10;
  return 5;
}

export function directBrief(brief: string, shotCount = 5): DirectorPlan {
  const clean = clip(brief.replace(/\s+/g, " ").trim(), 500);
  const count = Math.min(6, Math.max(4, Number.isFinite(shotCount) ? Math.round(shotCount) : 5));
  const cast = extractCast(clean);
  const locations = extractLocations(clean);
  const look = lightingFor(clean);
  const lenses = lensesFor(clean);
  const moves = movesFor(clean);
  const durationSec = durationFor(clean);
  const subject = cast[0]?.name ?? "Lead";
  const place = locations[0]?.name ?? "Open frame";
  const beats = [
    `Wide establish of ${place}. ${clean}`,
    `Introduce ${subject} in ${place}. ${look.lighting}.`,
    `Show the action clearly: ${clean}`,
    `Cut to a detail from the same moment around ${subject}.`,
    `Show what that action costs ${subject}.`,
    `Hold a closing image on ${place}.`,
  ];
  const shots: DirectorShot[] = beats.slice(0, count).map((action, index) => ({
    action: clip(action, 500),
    size: SIZES[index] ?? "medium",
    angle: ANGLES[index] ?? "eye level",
    movement: moves[index % moves.length] ?? "#lock-off",
    lens: lenses[index % lenses.length] ?? "35mm Anamorphic",
    focus: index % 3 === 0 ? "deep" : "shallow",
    lighting: look.lighting,
    mood: look.palette,
    durationSec,
    soundNote: "",
  }));
  const title = clip(`${subject} / ${place}`, 80);
  return { title, palette: look.palette, lighting: look.lighting, cast, locations, shots };
}
