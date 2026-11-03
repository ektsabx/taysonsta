import { z } from "zod";
import { TRUSTPILOT_REVIEW_URL } from "./community";

// Popups in Yolias, managed in Yolias Admin → Popups (owner, 2026-11-03,
// D-276; site_settings "yolias_popups", read on each request, no deploy).
// The welcome video keeps its own setting (lib/welcome-video.ts).
// Review request: asked once per user, after a real success the owner picks;
// everyone who gets there is asked the same way and nothing is offered in
// return (Trustpilot's guidelines).
export const POPUPS_KEY = "yolias_popups";
export const REVIEW_TRIGGERS = ["first_meeting", "first_positive_reply", "first_campaign"] as const;
export type ReviewTrigger = (typeof REVIEW_TRIGGERS)[number];

export const popupsSchema = z.object({
  review: z.object({
    enabled: z.boolean().catch(true),
    url: z.string().url().max(300).catch(TRUSTPILOT_REVIEW_URL),
    trigger: z.enum(REVIEW_TRIGGERS).catch("first_meeting"),
  }).catch({ enabled: true, url: TRUSTPILOT_REVIEW_URL, trigger: "first_meeting" }),
});
export type Popups = z.infer<typeof popupsSchema>;

export function parsePopups(value: unknown): Popups {
  return popupsSchema.parse(value ?? {});
}
