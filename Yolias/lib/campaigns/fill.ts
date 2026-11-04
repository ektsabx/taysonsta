import { z } from "zod";
import { emptyAdSet, type BuilderState } from "./builder";

// "Build with Yolias" (owner, 2026-11-05): the campaign Yolias AI proposes from
// the company's knowledge, and how it lands in the builder for review.

export const Filled = z.object({
  name: z.string().min(1).max(160), offer: z.string().max(1500), meetings: z.number().int().min(1).max(100),
  budget_usd: z.number().min(5).max(5000), messages_per_day: z.number().int().min(5).max(100),
  audiences: z.array(z.object({
    name: z.string().min(1).max(120), countries: z.array(z.string().length(2)).max(10), industries: z.array(z.string().min(1).max(120)).max(8),
    titles: z.array(z.string().min(1).max(120)).max(8), sizes: z.array(z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-"])).max(6),
  })).min(1).max(3),
});
export type CampaignFill = z.infer<typeof Filled>;


/** The proposal in the builder. Objective, channel and mailbox stay as the member set them. */
export function applyFill(cur: BuilderState, f: CampaignFill): BuilderState {
  const inc = (xs: string[]) => (xs.length ? { include: xs } : undefined);
  return {
    ...cur, name: f.name, offer: f.offer, targetMeetings: f.meetings, budgetUsd: f.budget_usd, dailyLimit: f.messages_per_day,
    adSets: f.audiences.map((a, i) => ({ ...emptyAdSet(i + 1, a.name), source: "new" as const, targeting: { countries: inc(a.countries.map((c) => c.toUpperCase())), industries: inc(a.industries), titles: inc(a.titles), sizes: inc(a.sizes) } })),
  };
}
