"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { confirmSetup, titleFrom, understandAndLaunch } from "@/lib/discovery/launch";
import { updateSettings } from "@/lib/discovery/campaign-control";
import { parseIcp, type IcpCriteria } from "@/lib/discovery/icp";
import { releaseDaily, takeDaily } from "@/lib/daily-limits";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { decide } from "@/lib/ai-workspace/settings";
import { LlmNotConfiguredError, runStructured } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { AIMS, cleanCtaUrl } from "@/lib/outreach/aim";
import { createAdminClient } from "@/lib/supabase/admin";
import { logCampaign } from "@/lib/campaigns/activity";
import type { Json } from "@/types/database";

// The campaign wizard (owner, 2026-10-31, D-270), after Facebook Ads: the
// member sets the goal, the audience, the target and dates, and the budget;
// Yolias proposes the strategy; the member launches. Three steps on the server:
//   1. understandAudience: the audience becomes search criteria (a strategy in
//      "setup", nothing runs and no prospect is used).
//   2. proposeStrategy: two angles for the first email, written for this
//      audience from the company's knowledge.
//   3. launchWizardCampaign: the search starts (prospects reserved = budget),
//      and the outreach campaign is made with its target, dates and limits.
//      Nothing is sent: when the first people are found, Yolias writes one
//      real first email and asks for one approval (lib/outreach/autopilot.ts).

export type WizardResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const list = z.array(z.string().trim().min(1).max(80)).max(20);
const audienceInput = z.object({
  description: z.string().trim().max(2000),
  countries: list, industries: list, titles: list,
  sizeMin: z.number().int().min(1).max(1_000_000).nullable(),
  sizeMax: z.number().int().min(1).max(1_000_000).nullable(),
});

export interface AudienceSummary {
  strategyId: string;
  name: string;
  summary: string;
  industries: string[];
  countries: string[];
  cities: string[];
  titles: string[];
  sizeMin: number | null;
  sizeMax: number | null;
  keywords: string[];
}

export async function understandAudience(input: z.input<typeof audienceInput>): Promise<WizardResult<{ audience: AudienceSummary }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const w = t.camp.wizard.errors;
  const p = audienceInput.safeParse(input);
  if (!p.success) return { ok: false, error: w.audience };
  const a = p.data;
  if (!a.description && !a.industries.length && !a.titles.length) return { ok: false, error: w.audience };
  const research = decide(await loadAiSettings(session.workspace.id), "research", "search_prospects");
  if (!research.allowed) return { ok: false, error: t.ws.ai.rules.searchBlocked };
  const slot = await takeDaily(session.userId, session.workspace.plan, "search");
  if (!slot.ok) return { ok: false, error: fmt(t.strategy.errors.dailyLimit, { count: slot.limit }) };

  // One request in the words the search already understands.
  const prompt = [
    a.description,
    a.industries.length ? `Industries: ${a.industries.join(", ")}` : "",
    a.countries.length ? `Countries: ${a.countries.join(", ")}` : "",
    a.titles.length ? `Decision makers: ${a.titles.join(", ")}` : "",
    a.sizeMin || a.sizeMax ? `Company size: ${a.sizeMin ?? 1} to ${a.sizeMax ?? "any"} employees` : "",
  ].filter(Boolean).join("\n");
  const db = await createClient();
  const { data: strategy, error } = await db.from("strategies").insert({
    workspace_id: session.workspace.id, created_by: session.userId, title: titleFrom(a.description || a.industries.join(", ") || "Campaign"), prompt, attachments: [] as Json,
  }).select("id").single();
  if (error || !strategy) { await releaseDaily(session.userId, "search"); return { ok: false, error: t.strategy.errors.startFailed }; }
  await understandAndLaunch(session, strategy.id, prompt, []);
  const { data: row } = await db.from("strategies").select("status, icp").eq("id", strategy.id).single();
  const icp = row?.status === "setup" ? parseIcp(row.icp) : null;
  if (!icp) return { ok: false, error: w.understand };
  // What the member picked by hand wins over what the model read.
  const merged: IcpCriteria = {
    ...icp,
    countries: a.countries.length ? a.countries : icp.countries,
    industries: a.industries.length ? a.industries : icp.industries,
    job_titles: a.titles.length ? a.titles : icp.job_titles,
    employees_min: a.sizeMin ?? icp.employees_min,
    employees_max: a.sizeMax ?? icp.employees_max,
  };
  await db.from("strategies").update({ icp: merged as unknown as Json }).eq("id", strategy.id);
  return {
    ok: true,
    audience: {
      strategyId: strategy.id, name: merged.campaign_name, summary: merged.summary, industries: merged.industries, countries: merged.countries, cities: merged.cities,
      titles: merged.job_titles, sizeMin: merged.employees_min, sizeMax: merged.employees_max, keywords: merged.keywords,
    },
  };
}

const AnglesSchema = z.object({
  angle_a: z.string().min(10).max(600),
  angle_b: z.string().min(10).max(600),
  why: z.string().min(10).max(500),
});
export interface Angles { a: string; b: string; why: string }

/** Step 5: two angles for the first email, for this audience, from what Yolias knows about the company. */
export async function proposeStrategy(strategyId: string, aim: string): Promise<WizardResult<{ angles: Angles }>> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!/^[0-9a-f-]{36}$/i.test(strategyId) || !(AIMS as readonly string[]).includes(aim)) return { ok: false, error: t.camp.wizard.errors.audience };
  const db = await createClient();
  const [{ data: s }, { data: knowledge }] = await Promise.all([
    db.from("strategies").select("icp").eq("id", strategyId).eq("workspace_id", session.workspace.id).maybeSingle(),
    db.from("workspace_knowledge").select("*").eq("workspace_id", session.workspace.id).maybeSingle(),
  ]);
  const icp = s ? parseIcp(s.icp) : null;
  if (!icp) return { ok: false, error: t.camp.wizard.errors.understand };
  const ws = session.workspace;
  const k = (knowledge ?? {}) as Record<string, unknown>;
  const facts = [
    `Company: ${ws.name}${ws.website ? ` (${ws.website})` : ""}`,
    ws.offering ? `What it sells: ${ws.offering}` : "",
    ...["about", "value_proposition", "services", "products", "differentiators", "case_studies", "pricing"].map((f) => (typeof k[f] === "string" && k[f] ? `${f.replace(/_/g, " ")}: ${String(k[f]).slice(0, 800)}` : "")),
    `Audience: ${icp.summary}`,
    icp.job_titles.length ? `Decision makers: ${icp.job_titles.join(", ")}` : "",
    `Goal of the campaign: ${aim === "meeting" ? "book a short meeting" : "a purchase on the website"}`,
  ].filter(Boolean).join("\n");
  try {
    const r = await runStructured(tasks.extraction, {
      system: [
        "You plan B2B cold email campaigns. Propose two different angles for the FIRST email to this audience.",
        "An angle is one or two sentences: the problem or outcome the email leads with and the proof it uses. Use only facts given; never invent numbers, clients or results.",
        "angle_a = the most direct angle for this audience. angle_b = a clearly different angle worth testing against it. why = one or two sentences on why these two, for the user.",
        `Write in ${session.profile.language === "ar" ? "Arabic" : "English"}.`,
      ].join("\n"),
      parts: [{ kind: "text", text: facts.slice(0, 6000) }],
      schema: { type: "object", properties: { angle_a: { type: "string" }, angle_b: { type: "string" }, why: { type: "string" } }, required: ["angle_a", "angle_b", "why"], additionalProperties: false },
      schemaName: "angles",
      maxTokens: 600,
    }, (x) => { const v = AnglesSchema.safeParse(x); return v.success ? v.data : null; }, { workspaceId: ws.id, campaignId: null, promptVersion: "wizard-angles-2026-10-31" });
    return { ok: true, angles: { a: r.data.angle_a, b: r.data.angle_b, why: r.data.why } };
  } catch (e) {
    if (!(e instanceof LlmNotConfiguredError)) console.error("[wizard] angles", e instanceof Error ? e.message : e);
    return { ok: false, error: t.camp.wizard.errors.angles };
  }
}

const launchInput = z.object({
  strategyId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  aim: z.enum(AIMS),
  ctaUrl: z.string().trim().max(500).nullable(),
  target: z.number().int().min(1).max(1000),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  budget: z.number().int().min(10).max(100_000),
  dailyLimit: z.number().int().min(1).max(500).nullable(),
  angleA: z.string().trim().min(1).max(1000),
  angleB: z.string().trim().max(1000).nullable(),
});

/** Step 6: start finding people and make the campaign. Nothing is sent before the member approves the first email. */
export async function launchWizardCampaign(input: z.input<typeof launchInput>): Promise<WizardResult<{ id: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const w = t.camp.wizard.errors;
  const p = launchInput.safeParse(input);
  if (!p.success) return { ok: false, error: w.settings };
  const c = p.data;
  const now = Date.now();
  if (c.endsAt && Date.parse(c.endsAt) <= Math.max(now, c.startsAt ? Date.parse(c.startsAt) : 0)) return { ok: false, error: w.dates };
  if (c.aim === "sell" && !cleanCtaUrl(c.ctaUrl)) return { ok: false, error: w.link };

  const db = await createClient();
  const { data: s } = await db.from("strategies").select("id, icp, status").eq("id", c.strategyId).eq("workspace_id", session.workspace.id).maybeSingle();
  const icp = s ? parseIcp(s.icp) : null;
  if (!s || !icp || s.status !== "setup") return { ok: false, error: w.understand };
  // The budget is the number of prospects the search may use (what the workspace pays for).
  const started = await confirmSetup(session, s.id, { ...icp, campaign_name: c.name, target_count: c.budget });
  if (started === "noPlan" || started === "noCredit") return { ok: false, error: started === "noPlan" ? w.noPlan : w.noCredit };
  if (!started) return { ok: false, error: w.understand };
  // A campaign with an end date keeps finding people daily until then, within its budget.
  if (c.endsAt) await updateSettings(db, started, { goal: c.budget, deadline: c.endsAt, continuous: true, everyHours: 24 });

  const settings = await loadAiSettings(session.workspace.id);
  const steps = Math.max(1, Math.min(3, settings.limits.max_messages_per_lead));
  const { data: camp, error } = await db.from("outreach_campaigns").insert({
    workspace_id: session.workspace.id, created_by: session.userId, name: c.name, channel: "email" as never,
    language: session.profile.language === "ar" ? "ar" : "en", tone: "direct" as never, aim: c.aim, cta_url: cleanCtaUrl(c.ctaUrl),
    goal: c.angleA, variant_b: c.angleB || null, source_campaign_id: started, strategy_id: s.id,
    target_meetings: c.target, starts_at: c.startsAt, ends_at: c.endsAt, daily_limit: c.dailyLimit, budget_prospects: c.budget,
  }).select("id").single();
  if (error || !camp) return { ok: false, error: w.settings };
  await db.from("outreach_steps").insert(Array.from({ length: steps }, (_, i) => ({
    workspace_id: session.workspace.id, campaign_id: camp.id, position: i + 1, delay_days: i === 0 ? 0 : i === 1 ? 3 : 7, objective: (i === 0 ? "introduction" : "follow_up") as never,
  })));
  await logCampaign(createAdminClient(), session.workspace.id, camp.id, "note",
    "Created. Yolias is finding the first people; when they are found it writes one real first email for your approval. Nothing is sent before that.",
    { target: c.target, budget: c.budget, starts_at: c.startsAt, ends_at: c.endsAt });
  revalidatePath("/outreach", "layout");
  return { ok: true, id: camp.id };
}
