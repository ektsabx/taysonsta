import { z } from "zod";

// Welcome video after sign-in (D-199). Configured in Yolias Admin → Platform
// → Onboarding (site_settings "yolias_welcome_video"); read on each request so
// a new link shows without a deploy. Shown once per user (profiles
// .welcome_video_seen_at); "Watch the intro video" in the menu reopens it.

export const WELCOME_VIDEO_KEY = "yolias_welcome_video";

export interface WelcomeVideo {
  title: string;
  description: string;
  /** What the player loads: an embeddable page (iframe) or a video file. */
  kind: "iframe" | "file";
  src: string;
  /** The original link (fallback "Open the video"). */
  url: string;
}

const settingSchema = z.object({
  enabled: z.boolean().catch(false),
  url: z.string().catch(""),
  title: z.string().max(200).catch(""),
  description: z.string().max(600).catch(""),
});

/** Turns a YouTube / Vimeo / Loom link or a direct .mp4 / .webm into what the player needs. Null = not usable. */
export function videoSource(raw: string): Pick<WelcomeVideo, "kind" | "src"> | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{6,20}$/.test(id) ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1] ?? "";
    return /^[\w-]{6,20}$/.test(id) ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    return id ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (host === "loom.com") {
    const id = u.pathname.match(/\/(?:share|embed)\/([a-f0-9]{20,})/i)?.[1];
    return id ? { kind: "iframe", src: `https://www.loom.com/embed/${id}` } : null;
  }
  if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: "file", src: u.toString() };
  return null;
}

/** The configured video, or null when it's off or the link can't be played. */
export function parseWelcomeVideo(value: unknown): WelcomeVideo | null {
  const s = settingSchema.safeParse(value ?? {});
  if (!s.success || !s.data.enabled || !s.data.url) return null;
  const source = videoSource(s.data.url);
  if (!source) return null;
  return { ...source, url: s.data.url.trim(), title: s.data.title.trim(), description: s.data.description.trim() };
}
