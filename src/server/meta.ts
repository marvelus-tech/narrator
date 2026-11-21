import type { Metadata } from "next";
import { pages, type PageKey } from "@/shared/routes";
import { siteUrl } from "@/server/ids";

function absolute(path: string): string {
  if (path === "/") return siteUrl();
  return `${siteUrl()}${path}`;
}

export function pageMeta(key: PageKey): Metadata {
  const page = pages[key];
  const url = absolute(page.canonical);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    robots: page.index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: "NR8R",
      type: "website",
    },
  };
}
