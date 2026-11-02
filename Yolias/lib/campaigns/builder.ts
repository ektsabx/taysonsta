import { z } from "zod";

// Creating a campaign (owner, 2026-10-31, D-273), after Facebook Ads Manager's
// three levels, made for Yolias:
//   1. Campaign  what the member wants: the result (meetings), what they
//                offer, the budget and the dates.
//   2. Audience  who to reach (one or more, like ad sets): locations, company
//                and people targeting and exclusions, or a saved audience.
//   3. Message   how Yolias speaks for them: the mailbox, the name, the tone,
//                the language and notes; a preview; the launch.
// No sequence to write: the emails, follow-ups and replies are Yolias's work
// (lib/agent-core/policy.ts). Shared by the browser and the server; a draft
// keeps this state in outreach_campaigns.wizard so the member can come back.

const list = z.array(z.string().trim().min(1).max(160)).max(200);
const field = z.object({ include: list.default([]), exclude: list.optional() });
/** A place's names, kept with the targeting so the server can say them without the browser's lists. */
const place = z.object({ en: z.string().max(160), ar: z.string().max(160).optional(), cc: z.string().length(2) });

export const targetingSchema = z.object({
  description: z.string().max(2000).optional(),
  countries: field.optional(), regions: field.optional(), cities: field.optional(),
  industries: field.optional(), company_types: field.optional(), sizes: field.optional(),
  hiring: field.optional(), funding: field.optional(), technologies: field.optional(), keywords: field.optional(),
  titles: field.optional(), seniority: field.optional(), departments: field.optional(),
  /** Companies (names or domains) never to contact in this audience. */
  exclude_companies: field.optional(),
  places: z.record(z.string(), place).optional(),
});

export const adSetSchema = z.object({
  key: z.string().max(40),
  name: z.string().trim().min(1).max(120),
  /** "new": Yolias finds people for this targeting; "audience": a saved audience from Audiences. */
  source: z.enum(["new", "audience"]).default("new"),
  audienceId: z.string().uuid().nullable().default(null),
  targeting: targetingSchema.default({}),
  /** Yolias's approach for this audience (two angles for the first email), written at preview or launch. */
  angleA: z.string().max(1000).default(""),
  angleB: z.string().max(1000).default(""),
});

export const builderSchema = z.object({
  level: z.enum(["campaign", "audience", "message"]).default("campaign"),
  // 1. Campaign
  name: z.string().max(160).default(""),
  /** D-274: the campaign type (outreach), its objective, its channel and whom it contacts. */
  objective: z.enum(["meetings", "purchases", "form_leads", "qualified_leads"]).default("meetings"),
  /** D-274: the website page for purchases or form leads (the link Yolias sends, tracked by the pixel). */
  websiteUrl: z.string().max(500).default(""),
  /** D-274: the pixel that measures a website objective, its conversion event, and the attribution window (days). */
  pixelId: z.string().uuid().nullable().default(null),
  conversionEvent: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/).nullable().default(null),
  attributionDays: z.union([z.literal(1), z.literal(7), z.literal(28)]).default(7),
  channel: z.enum(["email"]).default("email"),
  contactTarget: z.enum(["people", "companies", "both"]).default("people"),
  offerId: z.string().uuid().nullable().default(null),
  offer: z.string().max(1500).default(""),
  targetMeetings: z.number().int().min(1).max(1000).default(10),
  budgetType: z.enum(["total", "daily"]).default("total"),
  budgetUsd: z.number().min(0).max(1_000_000).default(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default("18:00"),
  timezone: z.string().max(64).default("UTC"),
  runDays: z.array(z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])).min(1).default(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]),
  contactFrom: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  contactTo: z.string().regex(/^\d{2}:\d{2}$/).default("17:00"),
  dailyLimit: z.number().int().min(1).max(500).default(30),
  /** D-274: the most a meeting that took place may cost (null = no cap), and recipient open tracking. */
  costCapUsd: z.number().min(0).max(100_000).nullable().default(null),
  trackOpens: z.boolean().default(true),
  // 2. Audiences
  adSets: z.array(adSetSchema).min(1).max(8),
  // 3. Message
  messageName: z.string().max(160).default(""),
  mailboxId: z.string().uuid().nullable().default(null),
  senderName: z.string().max(120).default(""),
  tone: z.enum(["direct", "friendly", "conservative"]).default("direct"),
  /** A language, or "mul": each person's language, from their country. */
  language: z.string().regex(/^[a-z]{2,3}$/).default("mul"),
  instructions: z.string().max(2000).default(""),
});
export type BuilderState = z.infer<typeof builderSchema>;
export type AdSet = z.infer<typeof adSetSchema>;
export type BuilderTargeting = z.infer<typeof targetingSchema>;

export const LEVELS = ["campaign", "audience", "message"] as const;
export type Level = (typeof LEVELS)[number];

export const emptyAdSet = (n: number, name: string): AdSet => adSetSchema.parse({ key: `a${Date.now().toString(36)}${n}`, name });

/** The smallest budget that can do anything: ten people at the member's rate. */
export const minBudgetUsd = (rate: number) => Math.max(1, Math.ceil(rate * 10 * 100) / 100);

/** What is missing before launch, per level (empty = ready). Mailbox and offer are checked on the server too. */
export function missing(s: BuilderState, rate: number): { level: Level; key: "name" | "budget" | "dates" | "audience" | "mailbox" | "website" | "pixel" }[] {
  const out: { level: Level; key: "name" | "budget" | "dates" | "audience" | "mailbox" | "website" | "pixel" }[] = [];
  if (!s.name.trim()) out.push({ level: "campaign", key: "name" });
  if (s.budgetUsd < minBudgetUsd(rate)) out.push({ level: "campaign", key: "budget" });
  if (s.endDate && s.startDate && s.endDate < s.startDate) out.push({ level: "campaign", key: "dates" });
  if (s.adSets.some((a) => (a.source === "audience" ? !a.audienceId : !hasAnyTargeting(a.targeting)))) out.push({ level: "audience", key: "audience" });
  // D-274: a website objective needs its page; a qualified-leads campaign contacts no one, so no mailbox.
  if ((s.objective === "purchases" || s.objective === "form_leads") && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(s.websiteUrl.trim())) out.push({ level: "campaign", key: "website" });
  // Like an ads platform: a website objective names the pixel that measures it.
  if ((s.objective === "purchases" || s.objective === "form_leads") && !s.pixelId) out.push({ level: "campaign", key: "pixel" });
  if (s.objective !== "qualified_leads" && !s.mailboxId) out.push({ level: "message", key: "mailbox" });
  return out;
}

export function hasAnyTargeting(t: BuilderTargeting): boolean {
  if (t.description?.trim()) return true;
  return Object.entries(t).some(([k, v]) => k !== "places" && k !== "description" && typeof v === "object" && v !== null && "include" in v && (v as { include: string[] }).include.length > 0);
}

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

/** Budget → how many new people Yolias may find and reach with it (a daily budget: one day's worth). */
export function budgetPeople(s: Pick<BuilderState, "budgetUsd">, rate: number): number {
  return rate > 0 ? Math.floor(s.budgetUsd / rate) : 0;
}

/** First emails the schedule allows (daily limit × running days), or null without an end date. */
export function scheduleCapacity(s: Pick<BuilderState, "startDate" | "endDate" | "runDays" | "dailyLimit">, today: string): number | null {
  if (!s.endDate) return null;
  const start = Date.parse(`${s.startDate || today}T00:00:00Z`), end = Date.parse(`${s.endDate}T00:00:00Z`);
  if (!(end >= start)) return 0;
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  let days = 0;
  for (let t = start; t <= end; t += 86_400_000) if (s.runDays.includes(keys[new Date(t).getUTCDay()] as never)) days++;
  return days * s.dailyLimit;
}

// Each person's language (language "mul"): from the country they're in.
const BY_COUNTRY: Record<string, string> = {
  SA: "ar", AE: "ar", EG: "ar", KW: "ar", QA: "ar", BH: "ar", OM: "ar", JO: "ar", LB: "ar", IQ: "ar", SY: "ar", PS: "ar", YE: "ar", LY: "ar", TN: "ar", DZ: "ar", MA: "ar", SD: "ar", MR: "ar",
  FR: "fr", BE: "fr", LU: "fr", SN: "fr", CI: "fr", ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", EC: "es", UY: "es", VE: "es",
  DE: "de", AT: "de", PT: "pt", BR: "pt", IT: "it", NL: "nl", TR: "tr", RU: "ru", ID: "id", JP: "ja", CN: "zh", TW: "zh",
};
/** The language to write to one person in: the campaign's, or their country's when the campaign says "mul". */
export function languageFor(campaignLanguage: string, country: string | null | undefined): string {
  if (campaignLanguage !== "mul") return campaignLanguage;
  const cc = (country ?? "").trim().toUpperCase();
  return (cc.length === 2 && BY_COUNTRY[cc]) || "en";
}
