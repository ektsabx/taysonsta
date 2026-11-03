// Lead score (audit, 2026-11-03): how well a person fits the audience and how
// interested they are, kept apart, and one score that weighs both:
//   fit 40 (the match score) · signals 20 (hiring, funding, technologies) ·
//   data completeness 10 (email, title, LinkedIn, phone) · engagement 30.
// Opens never count. Pure; shown on a person's page.

export type Engagement = "none" | "replied" | "interested" | "meeting";

const ENGAGEMENT: Record<Engagement, number> = { none: 0, replied: 10, interested: 22, meeting: 30 };

export interface LeadScoreInput {
  fit: number | null;
  signals: number;
  completeness: { email: boolean; title: boolean; linkedin: boolean; phone: boolean };
  engagement: Engagement;
}

export function leadScore(i: LeadScoreInput): { fit: number | null; interest: number; score: number } {
  const fit = i.fit == null ? null : Math.max(0, Math.min(100, Math.round(i.fit)));
  const complete = Object.values(i.completeness).filter(Boolean).length / 4;
  const score = ((fit ?? 0) / 100) * 40 + (Math.min(i.signals, 3) / 3) * 20 + complete * 10 + ENGAGEMENT[i.engagement];
  return { fit, interest: Math.round((ENGAGEMENT[i.engagement] / 30) * 100), score: Math.round(score) };
}

/** Engagement from a person's messages: a reply, an interested reply, or a meeting request. */
export function engagementOf(messages: { direction: string; analysis: unknown }[], hasMeeting = false): Engagement {
  if (hasMeeting) return "meeting";
  const inbound = messages.filter((m) => m.direction === "inbound");
  if (inbound.some((m) => ["interested", "meeting_request"].includes((m.analysis as { kind?: string } | null)?.kind ?? ""))) return "interested";
  return inbound.length ? "replied" : "none";
}
