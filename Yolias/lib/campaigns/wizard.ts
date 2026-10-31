import { z } from "zod";

// The campaign wizard's state (owner, 2026-10-31, D-272), shared by the
// browser (what the member fills in) and the server (drafts, estimates, the
// plan and the launch). A draft campaign keeps it in outreach_campaigns.wizard,
// so the member can leave and come back to the same step.

const list = z.array(z.string().trim().min(1).max(120)).max(50);
const field = z.object({ include: list.default([]), exclude: list.optional() });
export const targetingSchema = z.object({
  description: z.string().max(2000).optional(),
  countries: field.optional(), cities: field.optional(), industries: field.optional(), company_types: field.optional(), sizes: field.optional(),
  hiring: field.optional(), funding: field.optional(), technologies: field.optional(), keywords: field.optional(),
  titles: field.optional(), seniority: field.optional(), departments: field.optional(),
});

export const stepSchema = z.object({ delayDays: z.number().int().min(0).max(60), objective: z.enum(["introduction", "follow_up"]), instruction: z.string().max(500).default("") });

export const groupSchema = z.object({
  key: z.string().max(40),
  name: z.string().trim().min(1).max(120),
  source: z.enum(["find_new", "saved", "lookalike", "custom", "imported", "previous_campaign", "customers"]),
  targeting: targetingSchema.default({}),
  audienceId: z.string().uuid().nullable().default(null),
  fromCampaignId: z.string().uuid().nullable().default(null),
  seed: z.enum(["customers", "qualified", "meetings", "interested", "audience"]).nullable().default(null),
  seeds: z.array(z.string().max(200)).max(20).default([]),
  angleA: z.string().max(1000).default(""),
  angleB: z.string().max(1000).default(""),
  why: z.string().max(800).default(""),
  risks: z.string().max(800).default(""),
  steps: z.array(stepSchema).min(1).max(5).default([{ delayDays: 0, objective: "introduction", instruction: "" }, { delayDays: 3, objective: "follow_up", instruction: "" }, { delayDays: 7, objective: "follow_up", instruction: "" }]),
});

export const wizardSchema = z.object({
  step: z.number().int().min(0).max(5).default(0),
  name: z.string().max(160).default(""),
  objective: z.enum(["leads", "meetings", "opportunities", "new_customers", "reactivate", "promote", "custom"]).default("meetings"),
  customObjective: z.string().max(300).default(""),
  description: z.string().max(3000).default(""),
  ownerId: z.string().uuid().nullable().default(null),
  ctaUrl: z.string().max(500).default(""),
  budgetType: z.enum(["total", "daily", "monthly"]).default("total"),
  budgetUsd: z.number().min(0).max(1_000_000).default(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default("18:00"),
  timezone: z.string().max(64).default("UTC"),
  runDays: z.array(z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])).default(["sun", "mon", "tue", "wed", "thu"]),
  contactFrom: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  contactTo: z.string().regex(/^\d{2}:\d{2}$/).default("17:00"),
  dailyLimit: z.number().int().min(1).max(500).default(30),
  targetMeetings: z.number().int().min(0).max(1000).default(10),
  groups: z.array(groupSchema).min(1).max(8),
  channels: z.array(z.string()).default(["email"]),
  planned: z.boolean().default(false),
});
export type WizardState = z.infer<typeof wizardSchema>;
export type WizardGroup = z.infer<typeof groupSchema>;

/** The objective the email writer works toward: a meeting, or a purchase on the website. */
export const aimOf = (objective: WizardState["objective"]): "meeting" | "sell" => (objective === "promote" ? "sell" : "meeting");

/** A date + time in a time zone, as an ISO instant (the zone's offset at that moment). */
export function zonedIso(date: string, time: string, timeZone: string): string | null {
  if (!date) return null;
  const guess = new Date(`${date}T${time}:00Z`);
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const shown = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
    return new Date(guess.getTime() - (shown - guess.getTime())).toISOString();
  } catch {
    return guess.toISOString();
  }
}

/** Budget → prospects: the first period's share (daily / monthly) or the whole (total). */
export function budgetProspects(s: Pick<WizardState, "budgetUsd">, rate: number): number {
  return rate > 0 ? Math.floor(s.budgetUsd / rate) : 0;
}

/** How many people the schedule and limits allow to contact (before the budget): emails per day × running days. */
export function expectedVolume(s: Pick<WizardState, "startDate" | "endDate" | "runDays" | "dailyLimit">, today: string): number | null {
  if (!s.endDate) return null;
  const start = Date.parse(`${s.startDate || today}T00:00:00Z`), end = Date.parse(`${s.endDate}T00:00:00Z`);
  if (!(end >= start)) return 0;
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  let days = 0;
  for (let t = start; t <= end; t += 86_400_000) if (s.runDays.includes(keys[new Date(t).getUTCDay()] as never)) days++;
  return days * s.dailyLimit;
}

export const emptyGroup = (n: number, name: string): WizardGroup => groupSchema.parse({ key: `g${Date.now().toString(36)}${n}`, name, source: "find_new" });
