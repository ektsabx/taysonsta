import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberMailboxes } from "@/lib/mailbox";
import { timeZoneChoices, timeZoneLabel } from "@/lib/regions";
import { prospectRate } from "@/services/campaign-metrics";
import { monthlyUsage } from "@/services/workspace";
import type { BuilderProps } from "@/components/app/campaigns/CampaignBuilder";

// What the campaign builder needs (D-273), read once on the server: the rate
// and balance in dollars, offers, how complete Company Knowledge is, the
// member's mailboxes, booking page and calendar, saved audiences and zones.

const KNOWLEDGE = ["about", "services", "products", "pricing", "differentiators", "case_studies", "faqs", "value_proposition"] as const;

export async function builderContext(workspaceId: string, userId: string, zone: string, locale: "en" | "ar"): Promise<Omit<BuilderProps, "mode" | "campaignId" | "draftId" | "initial" | "locked">> {
  const db = createAdminClient();
  const [rate, usage, { data: offers }, { data: k }, boxes, { data: page }, { data: cal }, { data: audiences }] = await Promise.all([
    prospectRate(workspaceId), monthlyUsage(workspaceId),
    db.from("business_offers").select("id, name").eq("workspace_id", workspaceId).eq("active", true).order("created_at"),
    db.from("workspace_knowledge").select(KNOWLEDGE.join(", ")).eq("workspace_id", workspaceId).maybeSingle(),
    memberMailboxes(workspaceId, userId),
    db.from("booking_pages").select("slug, enabled").eq("user_id", userId).maybeSingle(),
    db.from("calendar_connections").select("status").eq("user_id", userId).maybeSingle(),
    db.from("audiences").select("id, name, kind, members").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
  ]);
  const { data: px } = await db.from("pixels").select("last_event_at").eq("workspace_id", workspaceId).maybeSingle();
  const kn = (k ?? null) as unknown as Record<string, unknown> | null;
  const filled = KNOWLEDGE.filter((f) => typeof kn?.[f] === "string" && (kn[f] as string).trim().length > 20).length;
  return {
    rate, balanceUsd: rate > 0 ? Math.max(Number(usage.available ?? 0), 0) * rate : null,
    offers: (offers ?? []).map((o) => ({ id: o.id, name: o.name })),
    knowledgePct: Math.round((filled / KNOWLEDGE.length) * 100),
    mailboxes: boxes.filter((m) => m.status === "connected").map((m) => ({ id: m.id, email: m.email, dailyLimit: m.daily_limit })),
    booking: { url: page?.enabled ? `/meet/${page.slug}` : null, calendar: cal?.status === "connected" },
    pixelSeen: Boolean(px?.last_event_at),
    audiences: (audiences ?? []).map((a) => ({ id: a.id, name: a.name, kind: a.kind as "saved" | "custom" | "lookalike", members: a.members })),
    zones: timeZoneChoices(zone).map((z) => ({ value: z, label: timeZoneLabel(z, locale) })),
    today: new Date().toISOString().slice(0, 10),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
/** An instant as the date and time in a zone (for the builder's inputs). */
function local(iso: string | null, zone: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "09:00" };
  try {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
  } catch {
    const d = new Date(iso);
    return { date: d.toISOString().slice(0, 10), time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
  }
}

/** The builder's state for a campaign that has none saved (an older draft) or that runs (edit). */
export async function stateFromCampaign(campaignId: string, workspaceId: string): Promise<{ state: Record<string, unknown>; locked: string[] } | null> {
  const db = createAdminClient();
  const { data: c } = await db.from("outreach_campaigns").select("*").eq("id", campaignId).eq("workspace_id", workspaceId).maybeSingle();
  if (!c) return null;
  const { data: groups } = await db.from("audience_groups").select("id, name, source, targeting, audience_id, angle_a, angle_b, status").eq("campaign_id", c.id).neq("status", "archived").order("created_at");
  const zone = c.timezone ?? "UTC";
  const s = local(c.starts_at, zone), e = local(c.ends_at, zone);
  const adSets = (groups ?? []).map((g, i) => ({
    key: `g${i}${g.id.slice(0, 6)}`, name: g.name, source: g.audience_id ? "audience" : "new", audienceId: g.audience_id, targeting: g.targeting ?? {},
    angleA: g.angle_a ?? "", angleB: g.angle_b ?? "",
  }));
  return {
    state: {
      level: "campaign", name: c.name, objective: c.objective === "qualified_leads" || c.objective === "purchases" || c.objective === "form_leads" ? c.objective : "meetings", websiteUrl: c.cta_url ?? "", channel: "email", contactTarget: c.contact_target ?? "people", messageName: c.message_name ?? "", offerId: c.offer_id, offer: c.description ?? "", targetMeetings: c.target_meetings ?? 10,
      budgetType: c.budget_type === "daily" ? "daily" : "total", budgetUsd: c.budget_usd == null ? 50 : Number(c.budget_usd),
      startDate: s.date, startTime: s.time, endDate: e.date, endTime: c.ends_at ? e.time : "18:00", timezone: zone,
      runDays: c.run_days?.length ? c.run_days : undefined, contactFrom: c.contact_from?.slice(0, 5) ?? "09:00", contactTo: c.contact_to?.slice(0, 5) ?? "17:00",
      dailyLimit: c.daily_limit ?? 30, costCapUsd: c.cost_cap_usd == null ? null : Number(c.cost_cap_usd), trackOpens: c.track_opens !== false, adSets: adSets.length ? adSets : [{ key: "g0", name: "Main audience" }],
      mailboxId: c.mailbox_id, senderName: c.sender_name ?? "", tone: c.tone, language: c.language ?? "mul", instructions: c.instructions ?? "",
    },
    locked: c.status === "draft" ? [] : (groups ?? []).map((g) => g.name),
  };
}
