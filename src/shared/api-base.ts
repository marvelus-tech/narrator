// Public origin of the full-stack Nr8tr server. Empty means same origin.
// This is not a secret. NEXT_PUBLIC_ values are visible to every visitor.

export function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() ?? "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) return appOrigin();
  return `${appOrigin()}${path}`;
}

export function followUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
