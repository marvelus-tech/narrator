import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const backup = path.join("/tmp", "narrator-pages-backup");

const touched = [
  "src/middleware.ts",
  "src/app/api",
  "src/app/opengraph-image.tsx",
  "src/app/app",
  "src/app/login/page.tsx",
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

const shell = `import Link from "next/link";
import { pageMeta } from "@/server/meta";
import { routes } from "@/shared/routes";

export const metadata = pageMeta("app");

export default function PagesDesk() {
  return (
    <div className="wrap section">
      <p className="kicker">Projects</p>
      <h1>Your desk</h1>
      <p className="lede">
        This Pages copy is the public site. Accounts, credits, and generation stay on the Narrator server.
      </p>
      <p>
        <Link className="btn" href={routes.pricing}>See pricing</Link>
      </p>
    </div>
  );
}
`;

const plain = (title, key, body) => `import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("${key}");

export default function Page() {
  return (
    <div className="wrap section">
      <h1>${title}</h1>
      <p className="lede">${body}</p>
    </div>
  );
}
`;

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
  write("src/app/app/page.tsx", shell);
  write(
    "src/app/app/billing/page.tsx",
    plain("Billing", "billing", "Checkout runs on the Narrator server. This static copy does not charge a card."),
  );
  write(
    "src/app/app/settings/page.tsx",
    plain("Settings", "settings", "Publishing keys stay on the server. This static copy has no account settings."),
  );
  write(
    "src/app/app/projects/new/page.tsx",
    plain("New brief", "newProject", "The planner runs on the Narrator server. This static copy does not save a brief."),
  );
  write(
    "src/app/login/page.tsx",
    `import { AuthForm } from "@/components/auth-form";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("login");

export default function LoginPage() {
  return (
    <div className="wrap section">
      <h1>Log in</h1>
      <p className="lede">Open your projects and the shot lists you have already priced.</p>
      <AuthForm mode="login" />
    </div>
  );
}
`,
  );

  execSync("npx next build", {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NARRATOR_PAGES: "1",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || "/narrator",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://marvelus-tech.github.io/narrator",
    },
  });
  writeFileSync(path.join(root, "out", ".nojekyll"), "");
} catch (err) {
  failed = err;
} finally {
  for (const rel of touched) restore(rel);
}

if (failed) {
  console.error(failed);
  process.exit(1);
}
console.log("pages export wrote out/");
