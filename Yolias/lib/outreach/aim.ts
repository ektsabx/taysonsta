import { specOf } from "@/lib/engine/objectives";
import type { CampaignAim } from "@/types/acquisition";

// What a campaign is for (owner 2026-10-30, D-268): book a meeting, or buy
// through the website. The same guidance steers the emails Yolias writes and
// the replies it sends: a meeting campaign leads to the member's Yolias
// booking page, a purchase campaign to the website link.
export const AIMS = ["meeting", "sell", "form"] as const satisfies readonly CampaignAim[];

/** D-274: the aim behind each objective: meetings → the booking page; purchases → the website; form leads → the form. */
export const aimOf = (objective: string | null | undefined): CampaignAim => { const l = specOf(objective).link; return l === "buy" ? "sell" : l === "form" ? "form" : "meeting"; };

/**
 * D-274: the website link for one person, carrying who they are (?yc=<lead>)
 * so the Yolias pixel on the site credits their visit, checkout, purchase or
 * form to the campaign that sent it.
 */
export function trackedLink(url: string | null, leadId: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (leadId) u.searchParams.set("yc", leadId);
    return u.href;
  } catch {
    return url;
  }
}

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
export const aimUsesLink = (aim: CampaignAim) => aim === "sell" || aim === "form";

/** One paragraph for the model: the campaign's aim and its link (the booking page for meetings). */
export function aimGuidance(aim: CampaignAim, ctaUrl: string | null, bookingUrl: string | null = null): string {
  if (aim === "form") {
    const link = ctaUrl ? ` Use exactly this link: ${ctaUrl}` : " Invite them to reply for the link.";
    return `Campaign aim: fill in the form on the website (a request, a quote or a sign-up), no meeting. Do not ask for a call. The call to action is to open the link and fill in the short form; say what they get after it.${link} Answer questions so they can decide on their own.`;
  }
  if (aim !== "sell") {
    const page = bookingUrl ? ` From the first follow-up on, or as soon as they show interest, give this booking page so they pick a time themselves: ${bookingUrl}` : "";
    return `Campaign aim: book a short meeting. The call to action is a short call. In the first email ask whether they are open to it.${page} Never invent a date or time.`;
  }
  const link = ctaUrl ? ` Use exactly this link: ${ctaUrl}` : " Invite them to reply for the link.";
  return `Campaign aim: purchase through the website, no meeting. Do not ask for a call or a meeting. The call to action is to visit the website and buy; give the one or two reasons that matter most to this person and answer what holds them back, without pressure or invented offers.${link} Answer questions so they can decide on their own.`;
}
