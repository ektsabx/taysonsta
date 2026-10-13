import { z } from "zod";
import type { AcquisitionSource } from "@/types/database";

// "How Did You Find Us?" (D-199): one answer per user, optional so it never
// blocks onboarding. "Other" needs a short text; any other answer has none.

export const ACQUISITION_SOURCES = [
  "google", "youtube", "tiktok", "friend", "x", "instagram", "review_site", "blog", "facebook",
  "ai_chat", "linkedin", "email", "reddit", "podcast", "other", "prefer_not_to_say",
] as const satisfies readonly AcquisitionSource[];

export type SourceAnswer = { source: AcquisitionSource; other: string | null } | null;

/** Empty = not answered (allowed). Returns the error key for a bad answer. */
export function parseSource(source: unknown, other: unknown): { ok: true; value: SourceAnswer } | { ok: false; error: "invalid" | "other" } {
  const s = typeof source === "string" ? source.trim() : "";
  if (!s) return { ok: true, value: null };
  const parsed = z.enum(ACQUISITION_SOURCES).safeParse(s);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data !== "other") return { ok: true, value: { source: parsed.data, other: null } };
  const text = typeof other === "string" ? other.trim().replace(/\s+/g, " ") : "";
  if (!text || text.length > 120) return { ok: false, error: "other" };
  return { ok: true, value: { source: "other", other: text } };
}
