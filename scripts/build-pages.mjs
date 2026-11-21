import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Pages cannot run Route Handlers, middleware, or cookie reads.
// Move those files aside for this build, export, then put them back.
const root = process.cwd();
const backup = path.join("/tmp", "narrator-pages-backup");
const touched = [
  "src/middleware.ts",
  "src/app/api",
  "src/app/opengraph-image.tsx",
  "src/app/app",
  "src/app/login/page.tsx",
  "src/app/signup/page.tsx",
];

function stash(rel) {
  const from = path.join(root, rel);
  if (!existsSync(from)) return;
  const to = path.join(backup, rel);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

function restore(rel) {
  const from = path.join(backup, rel);
  const to = path.join(root, rel);
  rmSync(to, { recursive: true, force: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

function write(rel, body) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
}

function deskPage(key, mode) {
  return `import { StaticDesk } from "@/components/static-desk";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("${key}");

export default function Page() {
  return <StaticDesk mode="${mode}" />;
}
`;
}

rmSync(backup, { recursive: true, force: true });
mkdirSync(backup, { recursive: true });
for (const rel of touched) stash(rel);

let failed = null;
try {
  rmSync(path.join(root, "src/middleware.ts"), { force: true });
  rmSync(path.join(root, "src/app/api"), { recursive: true, force: true });
  rmSync(path.join(root, "src/app/opengraph-image.tsx"), { force: true });
  rmSync(path.join(root, "src/app/app"), { recursive: true, force: true });
  write(
    "src/app/app/layout.tsx",
    `export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
`,
  );
  write("src/app/app/page.tsx", deskPage("app", "app"));
  write("src/app/login/page.tsx", deskPage("login", "login"));
  write("src/app/signup/page.tsx", deskPage("signup", "signup"));
  execSync("npx next build", {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      GITHUB_PAGES: "1",
      NEXT_PUBLIC_GITHUB_PAGES: "1",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || "/narrator",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://marvelus-tech.github.io/narrator",
    },
  });
} catch (err) {
  failed = err;
} finally {
  for (const rel of touched) restore(rel);
}

if (failed) {
  console.error(failed instanceof Error ? failed.message : failed);
  process.exit(1);
}
console.log("pages export wrote out/");
