import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nda-sentinel.vercel.app"
  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/ndas`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/ndas/new`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/report`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/violations`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/identity`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/analytics`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
  ]
}
