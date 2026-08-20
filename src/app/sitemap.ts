import type { MetadataRoute } from "next";
import { siteUrl } from "./site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/roadmap`, changeFrequency: "weekly", priority: 0.9 },
  ];
}
