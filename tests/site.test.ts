import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

describe("hosted database", () => {
  it("keeps sqlite schema off the Postgres migrations trigger", () => {
    expect(fs.existsSync("migrations")).toBe(false);
    expect(fs.existsSync("cursor-app.json")).toBe(false);
    expect(fs.existsSync("src/server/schema/001_init.sql")).toBe(true);
  });
});

describe("showcase media", () => {
  it("keeps original frames under the landing byte budget", () => {
    const dir = "public/showcase";
    const names = fs.readdirSync(dir);
    const webp = names.filter((name) => name.endsWith(".webp"));
    const mp4 = names.filter((name) => name.endsWith(".mp4"));
    expect(webp.length).toBeGreaterThanOrEqual(6);
    expect(mp4.length).toBeGreaterThanOrEqual(1);
    for (const name of webp) {
      expect(fs.statSync(path.join(dir, name)).size, name).toBeLessThan(80 * 1024);
    }
    for (const name of mp4) {
      expect(fs.statSync(path.join(dir, name)).size, name).toBeLessThan(400 * 1024);
    }
  });
});

function walkAll(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full, found);
    else if (/\.(tsx|ts|css)$/.test(entry.name)) found.push(full);
  }
  return found;
}
