import { spawnSync } from "node:child_process";
import path from "node:path";

const result = spawnSync(process.execPath, [path.join("scripts", "build-pages.mjs")], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
