import { z } from "zod";
import { videoSource } from "./welcome-video";

// Platform walkthrough videos (owner, 2026-10-28). Since 2026-11-10 each video
// belongs to a Help Center article and plays at the top of it (owner: the
// videos live inside the articles, no separate videos page). The list is
// edited in Yolias Admin → Platform videos (site_settings "yolias_tutorials")
// and read live, so a new video shows without a deploy. Shared with Admin: no
// "@/" imports.

export const TUTORIALS_KEY = "yolias_tutorials";

const text = z.object({ en: z.string().max(200).catch(""), ar: z.string().max(200).catch("") });
const long = z.object({ en: z.string().max(600).catch(""), ar: z.string().max(600).catch("") });
export const tutorialSchema = z.object({
  id: z.string().min(1).max(40),
  title: text,
  description: long.catch({ en: "", ar: "" }),
  url: z.string().max(500),
  /** The Help Center article (slug) the video plays in. */
  article: z.string().max(80).catch(""),
  published: z.boolean().catch(true),
  addedAt: z.string().max(40).catch(""),
});
export type Tutorial = z.infer<typeof tutorialSchema>;

/** Every stored video, in order (Admin). */
export function parseTutorials(value: unknown): Tutorial[] {
  const items = (value as { items?: unknown[] } | null)?.items;
  return Array.isArray(items) ? items.map((x) => tutorialSchema.safeParse(x)).filter((r) => r.success).map((r) => r.data) : [];
}

export interface PlayableTutorial { id: string; title: string; description: string; kind: "iframe" | "file"; src: string; url: string; article: string; addedAt: string }

/** The published videos with a playable link, in one language (Yolias). */
export function playableTutorials(value: unknown, locale: "en" | "ar"): PlayableTutorial[] {
  return parseTutorials(value).filter((t) => t.published).flatMap((t) => {
    const s = videoSource(t.url);
    const title = t.title[locale] || t.title.en || t.title.ar;
    return s && title ? [{ id: t.id, title, description: t.description[locale] || t.description.en, ...s, url: t.url, article: t.article, addedAt: t.addedAt }] : [];
  });
}

/** The published video of one Help Center article, or null. */
export function articleVideo(value: unknown, slug: string, locale: "en" | "ar"): PlayableTutorial | null {
  return playableTutorials(value, locale).find((t) => t.article === slug) ?? null;
}

/** A YouTube video's thumbnail (for VideoObject), or null for other hosts. */
export function youtubeThumb(url: string): string | null {
  const id = url.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{6,20})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
