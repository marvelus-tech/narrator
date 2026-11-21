import fs from "node:fs";
import path from "node:path";

// Hosted filesystems are often read-only outside /tmp. Probe the local data
// dir, then fall back. Never read DATABASE_URL here.
export function writableDataFile(name: string, configured: string | undefined): string {
  if (configured && configured !== "undefined") return path.resolve(configured);
  const local = path.resolve(process.cwd(), "data", name);
  if (dirWritable(path.dirname(local))) return local;
  return path.join("/tmp", "narrator", name);
}

function dirWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${process.pid}`);
    fs.writeFileSync(probe, "1");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
