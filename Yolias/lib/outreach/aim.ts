import type { CampaignAim } from "@/types/acquisition";

// What a campaign is for (owner 2026-10-30, D-268): book a meeting, or buy
// through the website. The same guidance steers the emails Yolias writes and
// the replies it sends: a meeting campaign leads to the member's Yolias
// booking page, a purchase campaign to the website link.
export const AIMS = ["meeting", "sell"] as const satisfies readonly CampaignAim[];

export const isAim = (v: unknown): v is CampaignAim => typeof v === "string" && (AIMS as readonly string[]).includes(v);

/** A safe http(s) link or null. */
export function cleanCtaUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return (u.protocol === "https:" || u.protocol === "http:") && u.href.length <= 500 ? u.href : null;
  } catch {
    return null;
  }
}

/** Only a purchase campaign asks for a link; a meeting campaign uses the member's booking page. */
export const aimUsesLink = (aim: CampaignAim) => aim === "sell";

/** One paragraph for the model: the campaign's aim and its link (the booking page for meetings). */
export function aimGuidance(aim: CampaignAim, ctaUrl: string | null, bookingUrl: string | null = null): string {
  if (aim !== "sell") {
    const page = bookingUrl ? ` From the first follow-up on, or as soon as they show interest, give this booking page so they pick a time themselves: ${bookingUrl}` : "";
    return `Campaign aim: book a short meeting. The call to action is a short call. In the first email ask whether they are open to it.${page} Never invent a date or time.`;
  }
  const link = ctaUrl ? ` Use exactly this link: ${ctaUrl}` : " Invite them to reply for the link.";
  return `Campaign aim: purchase through the website, no meeting. Do not ask for a call or a meeting. The call to action is to visit the website and sign up or buy.${link} Answer questions so they can decide on their own.`;
}
