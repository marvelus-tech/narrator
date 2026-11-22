import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const backup = path.join("/tmp", "narrator-pages-backup");

const touched = ["src/middleware.ts", "src/app/api", "src/app/opengraph-image.tsx", "src/app/app", "src/app/login/page.tsx"];

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

const appLayout = `export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
`;

const studio = `import { StaticStudioPreview } from "@/components/static-studio-preview";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("app");

export default function PagesStudio() {
  return (
    <div className="wrap section">
      <StaticStudioPreview />
    </div>
  );
}
`;

const onboarding = `import { StackConnect } from "@/components/stack-connect";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("onboarding");

export default function PagesOnboarding() {
  return (
    <div className="wrap section">
      <StackConnect />
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

const project = `import { StaticStudioPreview } from "@/components/static-studio-preview";

export function generateStaticParams() {
  return [{ id: "preview" }];
}

export default function PagesProject() {
  return (
    <div className="wrap section">
      <StaticStudioPreview />
    </div>
  );
}
`;

const login = `import { AuthForm } from "@/components/auth-form";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("login");

export default function LoginPage() {
  return (
    <div className="wrap section">
      <h1>Log in</h1>
      <p className="lede">Open the studio and the shot lists you have already priced.</p>
      <AuthForm mode="login" />
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
  write("src/app/app/layout.tsx", appLayout);
  write("src/app/app/page.tsx", studio);
  write("src/app/app/onboarding/page.tsx", onboarding);
  write("src/app/app/billing/page.tsx", plain("Billing", "billing", "Checkout runs on the Nr8tr server. This static copy does not charge a card."));
  write("src/app/app/settings/page.tsx", plain("Settings", "settings", "Publishing keys stay on the server. This static copy has no account settings."));
  write("src/app/app/projects/new/page.tsx", plain("New brief", "newProject", "The planner runs in this browser preview and on the Nr8tr server."));
  write("src/app/app/projects/[id]/page.tsx", project);
  write("src/app/login/page.tsx", login);
  execSync("npx next build", {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NARRATOR_PAGES: "1",
      NEXT_PUBLIC_PAGES: "1",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || "/nr8tr",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://marvelus-tech.github.io/nr8tr",
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
