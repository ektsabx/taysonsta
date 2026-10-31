"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { countryLabel } from "@/lib/format";
import { startGroupSearch } from "@/lib/campaigns/group-search";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { decide } from "@/lib/ai-workspace/settings";
import { LlmNotConfiguredError, runStructured } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { cleanCtaUrl } from "@/lib/outreach/aim";
import { enrollLeads } from "@/lib/outreach/sequence";
import { logCampaign } from "@/lib/campaigns/activity";
import { cleanChannels } from "@/lib/campaigns/channels";
import { estimate, lookalike, members, type Estimate, type Lookalike, type SeedKind } from "@/lib/campaigns/audience";
import { targetingPrompt, type Targeting } from "@/lib/campaigns/targeting";
import { aimOf, budgetProspects, wizardSchema, zonedIso, type WizardState } from "@/lib/campaigns/wizard";
import { prospectRate } from "@/services/campaign-metrics";
import type { Json } from "@/types/database";

// The campaign wizard on the server (owner, 2026-10-31, D-272):
//  saveDraft     the member can leave at any step; the draft is a campaign in
//                "draft" with the wizard's state, nothing runs.
//  estimateAudience / lookalikeOf   real numbers only (lib/campaigns/audience.ts).
//  planCampaign  per audience group: two first-email angles, why, risks.
//  launchCampaign  the campaign's settings, one search per "find new" group
//                (its share of the budget reserved), list groups enrolled
//                directly; nothing is sent until the first email is approved.

export type WizardResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function draftRow(state: WizardState) {
  return {
    name: (state.name.trim() || state.groups[0]?.name || "Campaign").slice(0, 160), objective: state.objective, description: state.description || null,
    aim: aimOf(state.objective), cta_url: cleanCtaUrl(state.ctaUrl || null), channel: "email" as never, channels: cleanChannels(state.channels),
    budget_type: state.budgetType, budget_usd: state.budgetUsd, timezone: state.timezone, run_days: state.runDays,
    contact_from: state.contactFrom, contact_to: state.contactTo, daily_limit: state.dailyLimit, target_meetings: state.targetMeetings || null,
    starts_at: zonedIso(state.startDate, state.startTime, state.timezone), ends_at: zonedIso(state.endDate, state.endTime, state.timezone),
    wizard: state as unknown as Json,
  };
}

export async function saveDraft(input: unknown, draftId: string | null): Promise<WizardResult<{ id: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const p = wizardSchema.safeParse(input);
  if (!p.success) return { ok: false, error: t.camp.wizard.errors.settings };
  const db = await createClient();
  const row = draftRow(p.data);
  if (draftId) {
    const { data } = await db.from("outreach_campaigns").update(row).eq("id", draftId).eq("workspace_id", session.workspace.id).eq("status", "draft").is("approved_at", null).select("id").maybeSingle();
    if (data) return { ok: true, id: data.id };
  }
  const { data, error } = await db.from("outreach_campaigns").insert({ ...row, workspace_id: session.workspace.id, created_by: session.userId, owner_id: p.data.ownerId ?? session.userId, language: session.profile.language === "ar" ? "ar" : "en", tone: "direct" as never }).select("id").single();
  if (error || !data) return { ok: false, error: t.camp.wizard.errors.settings };
  revalidatePath("/outreach");
  return { ok: true, id: data.id };
}

export async function estimateAudience(groups: unknown): Promise<WizardResult<{ estimates: Estimate[] }>> {
  const session = await requireSession();
  const p = z.array(z.record(z.string(), z.unknown())).max(8).safeParse(groups);
  if (!p.success) return { ok: false, error: (await getDictionary()).camp.wizard.errors.audience };
  return { ok: true, estimates: await estimate(session.workspace.id, p.data as Targeting[]) };
}

export async function lookalikeOf(kind: SeedKind, audienceId: string | null): Promise<WizardResult<{ lookalike: Lookalike }>> {
  const session = await requireSession();
  if (!["customers", "qualified", "meetings", "interested", "audience"].includes(kind)) return { ok: false, error: (await getDictionary()).camp.wizard.errors.audience };
  return { ok: true, lookalike: await lookalike(session.workspace.id, kind, audienceId ?? undefined) };
}

const PlanSchema = z.object({ groups: z.array(z.object({ angle_a: z.string().min(5).max(600), angle_b: z.string().min(5).max(600), why: z.string().min(5).max(500), risks: z.string().max(500) })) });

/** Step 5: per audience group, two angles for the first email, why, and the risks Yolias sees. */
export async function planCampaign(input: unknown): Promise<WizardResult<{ groups: { key: string; angleA: string; angleB: string; why: string; risks: string }[] }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const p = wizardSchema.safeParse(input);
  if (!p.success) return { ok: false, error: t.camp.wizard.errors.settings };
  const s = p.data;
  const db = await createClient();
  const { data: k } = await db.from("workspace_knowledge").select("about, value_proposition, services, products, differentiators, case_studies, pricing").eq("workspace_id", session.workspace.id).maybeSingle();
  const ws = session.workspace;
  const knowledge = [
    `Company: ${ws.name}${ws.website ? ` (${ws.website})` : ""}`, ws.offering ? `What it sells: ${ws.offering}` : "",
    ...Object.entries(k ?? {}).map(([f, v]) => (typeof v === "string" && v ? `${f.replace(/_/g, " ")}: ${v.slice(0, 700)}` : "")),
  ].filter(Boolean).join("\n");
  const groups = s.groups.map((g, i) => `Group ${i + 1} "${g.name}" (${g.source}):\n${targetingPrompt(g.targeting as Targeting, (c) => countryLabel(c, "en")) || "(a list of existing contacts)"}`).join("\n\n");
  const goal = s.objective === "custom" ? s.customObjective : s.objective;
  try {
    const r = await runStructured(tasks.extraction, {
      system: [
        "You plan B2B cold email campaigns. For EACH audience group, in order, propose two different angles for the FIRST email (angle_a = the most direct for that group, angle_b = a clearly different one worth testing), why (one or two sentences for the user), and risks (one sentence: what could make this group underperform, e.g. thin data, a crowded market, an unclear offer).",
        "An angle is one or two sentences: the problem or outcome the email leads with and the proof it uses. Use only the facts given; never invent numbers, clients or results.",
        `Campaign objective: ${goal}. Write in ${session.profile.language === "ar" ? "Arabic" : "English"}.`,
      ].join("\n"),
      parts: [{ kind: "text", text: `${knowledge}\n\nCampaign: ${s.name}\n${s.description}\n\n${groups}`.slice(0, 9000) }],
      schema: { type: "object", properties: { groups: { type: "array", items: { type: "object", properties: { angle_a: { type: "string" }, angle_b: { type: "string" }, why: { type: "string" }, risks: { type: "string" } }, required: ["angle_a", "angle_b", "why", "risks"], additionalProperties: false } } }, required: ["groups"], additionalProperties: false },
      schemaName: "campaign_plan",
      maxTokens: 1500,
    }, (x) => { const v = PlanSchema.safeParse(x); return v.success && v.data.groups.length === s.groups.length ? v.data : null; }, { workspaceId: ws.id, campaignId: null, promptVersion: "wizard-plan-2026-10-31" });
    return { ok: true, groups: r.data.groups.map((g, i) => ({ key: s.groups[i].key, angleA: g.angle_a, angleB: g.angle_b, why: g.why, risks: g.risks })) };
  } catch (e) {
    if (!(e instanceof LlmNotConfiguredError)) console.error("[wizard] plan", e instanceof Error ? e.message : e);
    return { ok: false, error: t.camp.wizard.errors.angles };
  }
}

/** Step 6: launch. Searches start (their budget reserved), list groups join; the first email still waits for one approval. */
export async function launchCampaign(input: unknown, draftId: string | null): Promise<WizardResult<{ id: string; warnings: string[] }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const w = t.camp.wizard.errors;
  const p = wizardSchema.safeParse(input);
  if (!p.success) return { ok: false, error: w.settings };
  const s = p.data;
  if (!s.name.trim()) return { ok: false, error: t.ws.outreach.errors.name };
  const startsAt = zonedIso(s.startDate, s.startTime, s.timezone), endsAt = zonedIso(s.endDate, s.endTime, s.timezone);
  if (endsAt && Date.parse(endsAt) <= Math.max(Date.now(), startsAt ? Date.parse(startsAt) : 0)) return { ok: false, error: w.dates };
  if (aimOf(s.objective) === "sell" && !cleanCtaUrl(s.ctaUrl || null)) return { ok: false, error: w.link };
  if (s.groups.some((g) => !g.angleA.trim())) return { ok: false, error: w.angles };
  const research = decide(await loadAiSettings(session.workspace.id), "research", "search_prospects");
  const finders = s.groups.filter((g) => g.source === "find_new" || g.source === "saved" || g.source === "lookalike");
  if (finders.length && !research.allowed) return { ok: false, error: t.ws.ai.rules.searchBlocked };

  // The campaign row (the draft, if there is one), still a draft until the first email is approved.
  const saved = await saveDraft(s, draftId);
  if (!saved.ok) return saved;
  const id = saved.id;
  const db = await createClient();
  const admin = createAdminClient();
  const rate = await prospectRate(session.workspace.id);
  const prospects = budgetProspects(s, rate);
  await db.from("outreach_campaigns").update({ budget_prospects: prospects || null, wizard: null, owner_id: s.ownerId ?? session.userId, goal: s.groups[0].angleA, variant_b: s.groups[0].angleB || null }).eq("id", id);

  const share = finders.length ? Math.floor(prospects / finders.length) : 0;
  const warnings: string[] = [];
  let firstSearch: string | null = null;
  for (const g of s.groups) {
    const { data: group, error } = await db.from("audience_groups").insert({
      workspace_id: session.workspace.id, campaign_id: id, name: g.name, source: g.source, targeting: g.targeting as unknown as Json,
      audience_id: g.audienceId, angle_a: g.angleA || null, angle_b: g.angleB || null, created_by: session.userId,
    }).select("id").single();
    if (error || !group) return { ok: false, error: w.settings };
    await db.from("outreach_steps").insert(g.steps.map((st, i) => ({
      workspace_id: session.workspace.id, campaign_id: id, audience_group_id: group.id, position: i + 1, delay_days: i === 0 ? 0 : st.delayDays, objective: st.objective as never, instruction: st.instruction || null,
    })));
    if (g.source === "find_new" || g.source === "saved" || g.source === "lookalike") {
      if (share < 10) { warnings.push(fmt(t.camp.wizard.warnings.budget, { name: g.name })); continue; }
      const r = await startGroupSearch(session, g, share, endsAt);
      if (r === "noPlan" || r === "noCredit") return { ok: false, error: r === "noPlan" ? w.noPlan : w.noCredit };
      if (!r) { warnings.push(fmt(t.camp.wizard.warnings.search, { name: g.name })); continue; }
      await db.from("audience_groups").update({ strategy_id: r.strategyId, search_campaign_id: r.searchId }).eq("id", group.id);
      firstSearch ??= r.searchId;
    } else {
      const ids = await members(session.workspace.id, g.source, { audienceId: g.audienceId, campaignId: g.fromCampaignId });
      const res = ids.length ? await enrollLeads(db as never, session.workspace.id, session.userId, id, ids, group.id) : null;
      if (!res?.added) warnings.push(fmt(t.camp.wizard.warnings.empty, { name: g.name }));
    }
  }
  // Campaign-wide default steps (the first group's), for leads added later by hand.
  await db.from("outreach_steps").insert(s.groups[0].steps.map((st, i) => ({
    workspace_id: session.workspace.id, campaign_id: id, position: i + 1, delay_days: i === 0 ? 0 : st.delayDays, objective: st.objective as never, instruction: st.instruction || null,
  })));
  if (firstSearch) await db.from("outreach_campaigns").update({ source_campaign_id: firstSearch }).eq("id", id);
  await logCampaign(admin, session.workspace.id, id, "note",
    "Launched. Yolias is finding the first people; when they are found it writes one real first email for your approval. Nothing is sent before that.",
    { groups: s.groups.length, prospects, budget_usd: s.budgetUsd, budget_type: s.budgetType });
  revalidatePath("/outreach", "layout");
  return { ok: true, id, warnings };
}
