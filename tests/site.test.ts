import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHOWCASE_FILM, SHOWCASE_GRAMMAR, PIPELINE_FRAMES } from "@/shared/showcase-film";
import { landing } from "@/shared/content";
import { quoteVideo } from "@/shared/economy";
import { publicAsset } from "@/shared/public-asset";
import { pages } from "@/shared/routes";

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name === "page.tsx") found.push(full.split(path.sep).join("/"));
  }
  return found;
}

describe("routes and metadata", () => {
  it("registers every page and links public pages from the footer", () => {
    const files = walk("src/app").filter((file) => file !== "src/app/not-found.tsx");
    const declared = Object.values(pages).map((page) => page.file).sort();
    expect(files.sort()).toEqual(declared);
    const footer = fs.readFileSync("src/shared/routes.ts", "utf8");
    for (const page of Object.values(pages)) {
      if (!page.index) continue;
      expect(footer).toContain(page.path === "/" ? 'home: "/"' : page.path);
    }
    const footerSource = fs.readFileSync("src/components/site-chrome.tsx", "utf8");
    expect(footerSource).toContain("footerNav");
    expect(footerSource).toContain("headerNav");
    const dashboard = fs.readFileSync("src/app/app/page.tsx", "utf8");
    expect(dashboard).toContain("routes.project");
    expect(dashboard).toContain("routes.newProject");
  });

  it("uses unique descriptions in range and no em dashes on pages", () => {
    const descriptions = Object.values(pages).map((page) => page.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const page of Object.values(pages)) {
      expect(page.description.length).toBeGreaterThanOrEqual(140);
      expect(page.description.length).toBeLessThanOrEqual(160);
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.canonical.startsWith("/")).toBe(true);
    }
    const roots = ["src/app", "src/components", "src/shared"];
    for (const root of roots) {
      const files = walkAll(root);
      for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        expect(text, file).not.toContain("\u2014");
        expect(text, file).not.toContain("\u2013");
      }
    }
  });
});

describe("pages asset prefix", () => {
  it("prefixes public files with the site base path", () => {
    const prev = process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(publicAsset("/showcase/shot-01.webp")).toBe("/showcase/shot-01.webp");
    process.env.NEXT_PUBLIC_BASE_PATH = "/nr8tr";
    expect(publicAsset("/showcase/shot-01.webp")).toBe("/nr8tr/showcase/shot-01.webp");
    expect(publicAsset("/nr8tr/showcase/shot-01.webp")).toBe("/nr8tr/showcase/shot-01.webp");
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = prev;
  });
});

describe("hosted database", () => {
  it("ships Postgres migrations and the Cursor database manifest", () => {
    const postgres = fs.readFileSync("migrations/001_init.sql", "utf8");
    const extra = fs.readFileSync("migrations/001_init_postgres.sql", "utf8");
    const app = fs.readFileSync("cursor-app.json", "utf8");
    expect(postgres).toContain("user_integrations");
    expect(extra).toContain("user_integrations");
    expect(app).toContain("postgres");
    expect(fs.existsSync("src/server/schema/001_init.sql")).toBe(true);
    expect(fs.readFileSync("src/server/schema/002_integrations.sql", "utf8")).toContain("user_integrations");
  });
});

describe("showcase media", () => {
  it("keeps original frames under the landing byte budget", () => {
    const dir = "public/showcase";
    const names = fs.readdirSync(dir);
    const webp = names.filter((name) => name.endsWith(".webp"));
    const mp4 = names.filter((name) => name.endsWith(".mp4"));
    expect(webp.length).toBeGreaterThanOrEqual(6);
    expect(mp4.length).toBeGreaterThanOrEqual(4);
    for (const name of webp) {
      expect(fs.statSync(path.join(dir, name)).size, name).toBeLessThan(80 * 1024);
    }
    for (const name of mp4) {
      expect(fs.statSync(path.join(dir, name)).size, name).toBeLessThan(400 * 1024);
    }
  });

  it("ships the four-shot film, pinned refs, and muted loops", () => {
    expect(pages.home.title).toBe("Nr8tr | Direct short films from a single brief");
    expect(pages.home.description).toBe(
      "Direct short films from one brief. Lock cast references, frame every shot, preview exact credit costs upfront, and cut scenes without studio markups.",
    );
    expect(pages.home.title).not.toMatch(/Narrator|NR8R/);
    expect(SHOWCASE_FILM.shots).toHaveLength(4);
    expect(SHOWCASE_FILM.refs.map((ref) => ref.label)).toEqual(["CAST A · LEAD", "SET B · DINER"]);
    expect(SHOWCASE_FILM.shots.map((shot) => shot.move)).toEqual(["DOLLY IN", "HANDHELD", "TRACK LEFT", "CRANE UP"]);
    expect(SHOWCASE_GRAMMAR.map((card) => card.title)).toEqual([
      "DOLLY IN · 50MM T1.4",
      "TRACKING · 35MM ANAMORPHIC",
      "CRANE WIDE · 24MM T2.0",
    ]);
    expect(landing.pipeline).toHaveLength(PIPELINE_FRAMES.length);
    const draft = quoteVideo("480p", 5).millicredits;
    const finish = quoteVideo("720p", 5).millicredits;
    expect(finish).toBeGreaterThan(draft);
    expect(SHOWCASE_FILM.shots.some((shot) => quoteVideo(shot.resolution, shot.seconds).millicredits === draft)).toBe(true);
    expect(SHOWCASE_FILM.shots.some((shot) => quoteVideo(shot.resolution, shot.seconds).millicredits === finish)).toBe(true);

    const files = [
      ...SHOWCASE_FILM.refs.map((ref) => ref.src),
      ...SHOWCASE_FILM.shots.flatMap((shot) => [shot.still, shot.loop]),
    ];
    for (const rel of files) {
      const full = path.join("public", rel.slice(1));
      expect(fs.existsSync(full), rel).toBe(true);
      const [width, height] = probe(full, "stream=width,height", "v:0").split(",").map(Number);
      expect(width, rel).toBeGreaterThan(0);
      expect(height, rel).toBeGreaterThan(0);
      if (rel.endsWith(".webp") && !rel.includes("cast-")) {
        expect(width / height, rel).toBeGreaterThan(2.3);
        expect(width / height, rel).toBeLessThan(2.45);
      }
      if (rel.endsWith(".mp4")) {
        expect(probe(full, "stream=index", "a"), rel).toBe("");
        const duration = Number(probe(full, "format=duration"));
        expect(duration, rel).toBeGreaterThan(2);
        expect(duration, rel).toBeLessThan(5);
      }
    }

    const hero = fs.readFileSync("src/components/cinema-hero.tsx", "utf8");
    const page = fs.readFileSync("src/app/page.tsx", "utf8");
    expect(hero).toContain("quoteVideo");
    expect(hero).toContain("routes.signup");
    expect(hero).toContain('data-ratio="2.39:1"');
    expect(hero).toContain("Play 4-shot cut");
    expect(page).toContain("cinema-home");
    expect(page).toContain("routes.pricing");
    expect(page).toContain("routes.how");
    expect(page).toContain("routes.signup");
  });
});

function probe(file: string, entries: string, stream?: string): string {
  const args = ["-v", "error"];
  if (stream) args.push("-select_streams", stream);
  args.push("-show_entries", entries, "-of", "csv=p=0", file);
  return execFileSync("ffprobe", args, { encoding: "utf8" }).trim();
}

function walkAll(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full, found);
    else if (/\.(tsx|ts|css)$/.test(entry.name)) found.push(full);
  }
  return found;
}
