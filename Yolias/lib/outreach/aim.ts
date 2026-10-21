import type { CampaignAim } from "@/types/acquisition";

// What a campaign is for (owner 2026-10-21, D-253). The same guidance steers
// the emails Yolias writes and the replies it sends, so the agent books a
// meeting only when the campaign is about meetings, and sends the sign-up /
// purchase link when the campaign sells directly (a SaaS like Yolias itself).
export const AIMS = ["meeting", "introduce", "sell"] as const satisfies readonly CampaignAim[];

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

/** One paragraph for the model: the campaign's aim and its link. */
/** Aims that use a link in the emails (a meeting link is sent by the member, not the agent). */
export const aimUsesLink = (aim: CampaignAim) => aim !== "meeting";

export function aimGuidance(aim: CampaignAim, ctaUrl: string | null): string {
  const link = ctaUrl ? ` Use exactly this link when it fits: ${ctaUrl}` : "";
  if (aim === "meeting") {
    // The member sends the meeting link themselves once the lead is interested (owner 2026-10-21).
    return "Campaign aim: a short meeting. The call to action is to ask whether they are open to a short call. Do not include a booking link and never propose a date or time; the sender follows up personally.";
  }
  if (aim === "sell") {
    return `Campaign aim: direct sale, no meeting. Do not ask for a call or a meeting. The call to action is to sign up, try or buy.${link || " Invite them to reply for the sign-up link."} Answer questions so they can decide on their own.`;
  }
  return `Campaign aim: introduce the company and start a conversation. Do not push for a meeting or a sale. The call to action is a reply: ask if this is relevant to them.${link ? ` For more information, this link: ${ctaUrl}` : ""}`;
}
