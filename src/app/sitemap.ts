import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/ids";
import { pages } from "@/shared/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(pages)
    .filter((page) => page.index)
    .map((page) => ({
      url: `${siteUrl()}${page.canonical === "/" ? "" : page.canonical}`,
      changeFrequency: "weekly",
      priority: page.canonical === "/" ? 1 : 0.7,
    }));
}
