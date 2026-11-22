// next/image with images.unoptimized copies a root src through unchanged.
// GitHub Pages hosts this app under NEXT_PUBLIC_BASE_PATH, so public files need that prefix.
export function publicAsset(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (!path.startsWith("/")) return path;
  if (base && (path === base || path.startsWith(`${base}/`))) return path;
  return `${base}${path}`;
}
