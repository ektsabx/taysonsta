"use server";

import { aimOf, cleanCtaUrl } from "@/lib/outreach/aim";
import { z } from "zod";
import { ownEvent } from "@/lib/own-pixel";
import { canUseApp } from "@/lib/plans";
import { intel } from "@/lib/intel/db";
import { startBlock } from "@/lib/discovery/launch";
import { Filled, type CampaignFill } from "@/lib/campaigns/fill";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, canEdit, viewOnly } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { countryLabel } from "@/lib/format";
import { startGroupSearch } from "@/lib/campaigns/group-search";
import { contextText, loadAiSettings, loadBusinessContext } from "@/lib/ai-workspace/server";
import { decide } from "@/lib/ai-workspace/settings";
import { LlmNotConfiguredError, runStructured } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { enrollLeads } from "@/lib/outreach/sequence";
import { approveCampaign } from "@/lib/outreach/execute";
import { writeSample } from "@/lib/outreach/index";
import { isMessageLanguage } from "@/lib/outreach/channels";
import { logCampaign } from "@/lib/campaigns/activity";
import { estimate, members, type Estimate } from "@/lib/campaigns/audience";
import { targetingPrompt, values, placeName, type Targeting } from "@/lib/campaigns/targeting";
import { budgetPeople, builderSchema, minBudgetUsd, missing, zonedIso, languageFor, type AdSet, type BuilderState } from "@/lib/campaigns/builder";
import { CONVERSATION } from "@/lib/agent-core/policy";
import { insightLines } from "@/lib/agent-core/learning";
import { prospectRate } from "@/services/campaign-metrics";
import type { Json } from "@/types/database";

// Creating a campaign (owner, 2026-10-31, D-273): Campaign → Audiences →
// Message, on one page.
//  saveDraft       the member can leave at any level; the draft is a campaign
//                  in "draft" holding the builder's state, nothing runs.
//  checkAudiences  real numbers only (lib/campaigns/audience.ts).
//  writeApproach   Yolias's two openings for one audience.
//  previewEmail    a sample first email for a typical person of an audience.
//  launchCampaign  the campaign, its audiences (each one's search or list),
//                  the hidden follow-up plan (lib/agent-core/policy.ts) and the
//                  go-ahead to send from the member's mailbox. Launching is the
//                  approval: there is no per-email approval after it.
//  updateCampaign  edit a launched campaign (its settings and message) and add
//                  audiences; a running audience's targeting stays as it is.

export type BuilderResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; needsCredit?: boolean };

function row(s: BuilderState) {
  return {
    name: (s.name.trim() || s.adSets[0]?.name || "Campaign").slice(0, 160), objective: s.objective, aim: aimOf(s.objective), cta_url: s.objective === "purchases" || s.objective === "form_leads" ? cleanCtaUrl(s.websiteUrl) : null,
    contact_target: s.contactTarget, message_name: s.messageName.trim() || null,
    pixel_id: s.objective === "purchases" || s.objective === "form_leads" ? s.pixelId : null,
    conversion_event: s.objective === "purchases" ? s.conversionEvent ?? "Purchase" : s.objective === "form_leads" ? s.conversionEvent ?? "Lead" : null,
    attribution_days: s.attributionDays,
    description: s.offer.trim() || null, offer_id: s.offerId, channel: "email" as never, channels: [s.channel],
    budget_type: s.budgetType, budget_usd: s.budgetUsd, timezone: s.timezone, run_days: s.runDays,
    contact_from: s.contactFrom, contact_to: s.contactTo, daily_limit: s.dailyLimit, target_meetings: s.targetMeetings,
    cost_cap_usd: s.costCapUsd && s.costCapUsd > 0 ? s.costCapUsd : null, track_opens: s.trackOpens,
    starts_at: zonedIso(s.startDate, s.startTime, s.timezone), ends_at: zonedIso(s.endDate, s.endTime, s.timezone),
    tone: s.tone as never, language: s.language, sender_name: s.senderName.trim() || null, instructions: s.instructions.trim() || null,
    // The mailbox stays in the draft's state: the server records it at launch (approveCampaign) or on edit.
    wizard: s as unknown as Json,
  };
}

export async function saveDraft(input: unknown, draftId: string | null): Promise<BuilderResult<{ id: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const p = builderSchema.safeParse(input);
  if (!p.success) return { ok: false, error: t.ag.builder.errors.settings };
  const db = await createClient();
  const r = row(p.data);
  if (draftId) {
    const { data } = await db.from("outreach_campaigns").update(r).eq("id", draftId).eq("workspace_id", session.workspace.id).eq("status", "draft").is("approved_at", null).select("id").maybeSingle();
    if (data) return { ok: true, id: data.id };
  }
  const { data, error } = await db.from("outreach_campaigns").insert({ ...r, workspace_id: session.workspace.id, created_by: session.userId, owner_id: session.userId }).select("id").single();
  if (error || !data) return { ok: false, error: t.ag.builder.errors.settings };
  // Activated (owner, 2026-11-05): the account built its first campaign. The event id keeps it to once.
  await ownEvent("Activated", { email: session.email, eventId: `activated:${session.workspace.id}` });
  revalidatePath("/campaigns");
  return { ok: true, id: data.id };
}

const adSetsInput = z.array(z.object({ source: z.enum(["new", "audience"]), audienceId: z.string().uuid().nullable(), targeting: z.record(z.string(), z.unknown()) })).max(8);

/** Per audience: the matching companies and people Yolias already has (a saved audience: its size). */
export async function checkAudiences(input: unknown): Promise<BuilderResult<{ estimates: Estimate[] }>> {
  const session = await requireMember();
  const p = adSetsInput.safeParse(input);
  if (!p.success) return { ok: false, error: (await getDictionary()).ag.builder.errors.audience };
  const ws = session.workspace.id;
  const admin = createAdminClient();
  const out: Estimate[] = [];
  for (const a of p.data) {
    if (a.source === "audience" && a.audienceId) {
      const { data: aud } = await admin.from("audiences").select("kind, targeting, members").eq("id", a.audienceId).eq("workspace_id", ws).maybeSingle();
      if (aud?.kind === "custom") {
        const ids = await members(ws, "custom", { audienceId: a.audienceId });
        const { data } = ids.length ? await admin.from("sales_leads").select("email").eq("workspace_id", ws).in("id", ids.slice(0, 5000)) : { data: [] };
        out.push({ known: ids.length, email: (data ?? []).filter((l) => l.email).length });
      } else out.push((await estimate(ws, [(aud?.targeting ?? {}) as Targeting]))[0]);
    } else out.push((await estimate(ws, [a.targeting as Targeting]))[0]);
  }
  return { ok: true, estimates: out };
}

/** What an audience is, in words, and its seed companies when it is a lookalike. */
async function audienceOf(ws: string, a: AdSet): Promise<{ targeting: Targeting; seeds: string[]; kind: "search" | "list"; audienceName: string | null }> {
  if (a.source !== "audience" || !a.audienceId) return { targeting: a.targeting as Targeting, seeds: [], kind: "search", audienceName: null };
  const { data: aud } = await createAdminClient().from("audiences").select("kind, name, targeting, origin").eq("id", a.audienceId).eq("workspace_id", ws).maybeSingle();
  const origin = (aud?.origin ?? {}) as { seeds?: string[] };
  return { targeting: (aud?.targeting ?? {}) as Targeting, seeds: aud?.kind === "lookalike" ? origin.seeds ?? [] : [], kind: aud?.kind === "custom" ? "list" : "search", audienceName: aud?.name ?? null };
}

async function knowledgeText(ws: string, session: Awaited<ReturnType<typeof requireMember>>, s: BuilderState): Promise<string> {
  const db = await createClient();
  const { data: k } = await db.from("workspace_knowledge").select("about, value_proposition, services, products, differentiators, case_studies, pricing").eq("workspace_id", ws).maybeSingle();
  const { data: offer } = s.offerId ? await db.from("business_offers").select("name, description").eq("id", s.offerId).eq("workspace_id", ws).maybeSingle() : { data: null };
  return [
    `Company: ${session.workspace.name}${session.workspace.website ? ` (${session.workspace.website})` : ""}`, session.workspace.offering ? `What it sells: ${session.workspace.offering}` : "",
    offer ? `This campaign offers: ${offer.name}${offer.description ? `: ${offer.description}` : ""}` : s.offer.trim() ? `This campaign offers: ${s.offer.trim()}` : "",
    ...Object.entries(k ?? {}).map(([f, v]) => (typeof v === "string" && v ? `${f.replace(/_/g, " ")}: ${v.slice(0, 700)}` : "")),
  ].filter(Boolean).join("\n");
}

const Approach = z.object({ angle_a: z.string().min(5).max(600), angle_b: z.string().min(5).max(600) });

async function approachFor(session: Awaited<ReturnType<typeof requireMember>>, s: BuilderState, a: AdSet): Promise<{ angleA: string; angleB: string } | null> {
  const ws = session.workspace.id;
  const aud = await audienceOf(ws, a);
  const who = targetingPrompt(aud.targeting, (c) => countryLabel(c, "en")) || (aud.audienceName ? `People in the audience "${aud.audienceName}"` : a.name);
  try {
    const r = await runStructured(tasks.extraction, {
      system: [
        "You plan the first cold email of a B2B campaign whose only goal is a short meeting. Propose two different openings for this audience: angle_a = the most direct (the outcome this audience most likely wants, tied to the offer), angle_b = a clearly different one worth testing (a different problem, proof or reason now).",
        "Each opening is one or two sentences: what the email leads with and the proof it uses. Use only the facts given; never invent numbers, clients or results.",
        `Write in ${session.profile.language === "ar" ? "Arabic" : "English"}.`,
      ].join("\n"),
      parts: [{ kind: "text", text: `${await knowledgeText(ws, session, s)}\n\nCampaign: ${s.name}\nAudience "${a.name}":\n${who}\n\n${await insightLines(ws)}`.slice(0, 9000) }],
      schema: { type: "object", properties: { angle_a: { type: "string" }, angle_b: { type: "string" } }, required: ["angle_a", "angle_b"], additionalProperties: false },
      schemaName: "campaign_approach",
      maxTokens: 700,
    }, (x) => { const v = Approach.safeParse(x); return v.success ? v.data : null; }, { workspaceId: ws, campaignId: null, promptVersion: "builder-approach-2026-10-31" });
    return { angleA: r.data.angle_a, angleB: r.data.angle_b };
  } catch (e) {
    if (!(e instanceof LlmNotConfiguredError)) console.error("[builder] approach", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function writeApproach(input: unknown, key: string): Promise<BuilderResult<{ angleA: string; angleB: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const p = builderSchema.safeParse(input);
  const a = p.success ? p.data.adSets.find((x) => x.key === key) : null;
  if (!p.success || !a) return { ok: false, error: t.ag.builder.errors.settings };
  if (await freeAiSpent(session)) return { ok: false, error: t.ag.builder.errors.freeAi, needsCredit: true };
  const r = await approachFor(session, p.data, a);
  return r ? { ok: true, ...r } : { ok: false, error: t.ag.builder.errors.approach };
}

/** Free accounts: AI help in the builder up to a daily limit, so a free signup can't run up model costs. */
const FREE_AI_PER_DAY = 30;
async function freeAiSpent(session: Awaited<ReturnType<typeof requireMember>>): Promise<boolean> {
  if (canUseApp(session.workspace)) return false;
  const { count } = await intel().from("llm_calls").select("id", { count: "exact", head: true }).eq("workspace_id", session.workspace.id).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  return (count ?? 0) >= FREE_AI_PER_DAY;
}

/**
 * The whole campaign from what Yolias knows about the company (owner,
 * 2026-11-05): name, offer, target, budget, messages a day and audiences, for
 * the member to review. Nothing is saved or launched here.
 */
export async function fillCampaign(): Promise<BuilderResult<{ fill: CampaignFill }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (await freeAiSpent(session)) return { ok: false, error: t.ag.builder.errors.freeAi, needsCredit: true };
  const ws = session.workspace.id;
  const knowledge = contextText(await loadBusinessContext(ws));
  if (!knowledge.trim()) return { ok: false, error: t.ag.builder.errors.fillNoKnowledge };
  const { $schema: _drop, ...schema } = z.toJSONSchema(Filled) as Record<string, unknown>;
  void _drop;
  try {
    const r = await runStructured(tasks.extraction, {
      system: [
        "You set up one B2B customer acquisition campaign for this company, using only what its knowledge says.",
        "name: short, the market and the audience. offer: what the campaign sells, in one or two sentences. meetings: a realistic target. budget_usd: at least 5, a sensible first test. messages_per_day: 15 to 40.",
        "audiences: one to three different groups of decision makers who would buy. countries as ISO codes from the company's target markets; industries; job titles of the people who decide; company sizes.",
        "Never invent clients, numbers or results.",
        `Write in ${session.profile.language === "ar" ? "Arabic" : "English"}.`,
      ].join("\n"),
      parts: [{ kind: "text", text: `${knowledge}\n\n${await insightLines(ws)}`.slice(0, 9000) }],
      schema, schemaName: "campaign_fill", maxTokens: 1200,
    }, (x) => { const v = Filled.safeParse(x); return v.success ? v.data : null; }, { workspaceId: ws, campaignId: null, promptVersion: "builder-fill-2026-11-05" });
    return { ok: true, fill: r.data };
  } catch (e) {
    if (!(e instanceof LlmNotConfiguredError)) console.error("[builder] fill", e instanceof Error ? e.message : e);
    return { ok: false, error: t.ag.builder.errors.fill };
  }
}

/** A sample first email for a typical person of one audience (nothing saved, nothing sent). */
export async function previewEmail(input: unknown, key: string): Promise<BuilderResult<{ subject: string; body: string; who: string; angleA: string; angleB: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (await freeAiSpent(session)) return { ok: false, error: t.ag.builder.errors.freeAi, needsCredit: true };
  const p = builderSchema.safeParse(input);
  const a = p.success ? p.data.adSets.find((x) => x.key === key) : null;
  if (!p.success || !a) return { ok: false, error: t.ag.builder.errors.settings };
  const s = p.data;
  const angles = a.angleA.trim() ? { angleA: a.angleA, angleB: a.angleB } : await approachFor(session, s, a);
  if (!angles) return { ok: false, error: t.ag.builder.errors.approach };
  const aud = await audienceOf(session.workspace.id, a);
  const tg = aud.targeting;
  const ar = session.profile.language === "ar";
  // Only what the audience says about this person: a role, an industry, a place. No invented name or company.
  const title = values(tg, "titles")[0] ?? values(tg, "seniority")[0] ?? null;
  const industry = values(tg, "industries")[0] ?? values(tg, "company_types")[0] ?? null;
  const country = values(tg, "countries")[0] ?? null;
  const city = values(tg, "cities")[0] ? placeName(tg, values(tg, "cities")[0], ar ? "ar" : "en") : null;
  const facts = {
    prospect: Object.fromEntries(Object.entries({ job_title: title, country }).filter(([, v]) => v)),
    prospect_company: Object.fromEntries(Object.entries({ industry, city, country, size: values(tg, "sizes")[0] }).filter(([, v]) => v)),
  };
  const lang = languageFor(s.language, country);
  const r = await writeSample({
    workspaceId: session.workspace.id, userId: session.userId, facts, offerId: s.offerId,
    instruction: [`Campaign aim: book a short meeting. The call to action is a short call.`, angles.angleA, s.offer.trim() ? `The offer: ${s.offer.trim()}` : ""].filter(Boolean).join("\n"),
    language: isMessageLanguage(lang) ? lang : "en", tone: s.tone, senderName: s.senderName, notes: s.instructions, insights: await insightLines(session.workspace.id),
  });
  if (!r) return { ok: false, error: t.ag.builder.errors.preview };
  const who = [title, industry && (ar ? `في ${industry}` : `at a ${industry} company`), city ?? (country ? countryLabel(country, ar ? "ar" : "en") : null)].filter(Boolean).join(ar ? "، " : ", ") || a.name;
  return { ok: true, subject: r.subject, body: r.body, who, ...angles };
}

/** Starts one audience: a search for a targeting or lookalike, or the people of a custom audience. Returns a warning or null. */
async function startAudience(session: Awaited<ReturnType<typeof requireMember>>, campaignId: string, a: AdSet, share: number, endsAt: string | null): Promise<string | "noPlan" | "noCredit" | null> {
  const t = await getDictionary();
  const w = t.ag.builder.warnings;
  const db = await createClient();
  const aud = await audienceOf(session.workspace.id, a);
  const { data: audRow } = a.audienceId ? await db.from("audiences").select("kind").eq("id", a.audienceId).maybeSingle() : { data: null };
  const source = a.source === "new" ? "find_new" : audRow?.kind === "lookalike" ? "lookalike" : audRow?.kind === "custom" ? "custom" : "saved";
  // An older draft may already hold this audience (with its people or its search): it is reused, not doubled.
  const { data: prior } = await db.from("audience_groups").select("id, search_campaign_id").eq("campaign_id", campaignId).eq("name", a.name).limit(1).maybeSingle();
  if (prior) {
    await db.from("audience_groups").update({ angle_a: a.angleA || null, angle_b: a.angleB || null, status: "active" }).eq("id", prior.id);
    const { count } = await db.from("outreach_enrollments").select("id", { count: "exact", head: true }).eq("audience_group_id", prior.id);
    if (prior.search_campaign_id || count) return null;
  }
  const { data: group, error } = prior ? { data: { id: prior.id }, error: null } : await db.from("audience_groups").insert({
    workspace_id: session.workspace.id, campaign_id: campaignId, name: a.name, source, targeting: aud.targeting as unknown as Json,
    audience_id: a.audienceId, angle_a: a.angleA || null, angle_b: a.angleB || null, created_by: session.userId,
  }).select("id").single();
  if (error || !group) return fmt(w.search, { name: a.name });
  if (aud.kind === "list") {
    const ids = await members(session.workspace.id, "custom", { audienceId: a.audienceId });
    const res = ids.length ? await enrollLeads(db as never, session.workspace.id, session.userId, campaignId, ids, group.id) : null;
    return res?.added ? null : fmt(w.empty, { name: a.name });
  }
  if (share < 10) return fmt(w.budget, { name: a.name });
  const r = await startGroupSearch(session, { name: a.name, targeting: aud.targeting, seeds: aud.seeds }, share, endsAt);
  if (r === "noPlan" || r === "noCredit") return r;
  if (!r) return fmt(w.search, { name: a.name });
  await db.from("audience_groups").update({ strategy_id: r.strategyId, search_campaign_id: r.searchId }).eq("id", group.id);
  return null;
}

/** The first email and the follow-ups Yolias sends to someone who doesn't reply (the policy's, not the member's to write). */
async function followUpPlan(campaignId: string, ws: string) {
  const db = createAdminClient();
  const { count } = await db.from("outreach_steps").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).is("audience_group_id", null);
  if (count) return;
  const gaps = [0, ...CONVERSATION.followUpDays].slice(0, CONVERSATION.maxColdMessages);
  await db.from("outreach_steps").insert(gaps.map((d, i) => ({
    workspace_id: ws, campaign_id: campaignId, position: i + 1, delay_days: d, objective: (i === 0 ? "introduction" : "follow_up") as never, instruction: null,
  })));
}

export async function launchCampaign(input: unknown, draftId: string | null, confirmed: boolean): Promise<BuilderResult<{ id: string; warnings: string[] }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const e = t.ag.builder.errors;
  const p = builderSchema.safeParse(input);
  if (!p.success) return { ok: false, error: e.settings };
  const s = p.data;
  const rate = await prospectRate(session.workspace.id);
  const gaps = missing(s, rate);
  const usd = (v: number) => `$${v.toFixed(2)}`;
  if (gaps.length) {
    const k = gaps[0].key;
    return { ok: false, error: k === "budget" ? fmt(e.budget, { usd: usd(minBudgetUsd(rate)) }) : e[k] };
  }
  if (!confirmed && s.objective !== "qualified_leads") return { ok: false, error: e.confirm };
  const startsAt = zonedIso(s.startDate, s.startTime, s.timezone), endsAt = zonedIso(s.endDate, s.endTime, s.timezone);
  if (endsAt && Date.parse(endsAt) <= Math.max(Date.now(), startsAt ? Date.parse(startsAt) : 0)) return { ok: false, error: e.dates };
  const admin = createAdminClient();
  // D-274: a qualified-leads campaign only finds and saves people (Leads): no mailbox, no messages.
  const findOnly = s.objective === "qualified_leads";
  const { data: mb } = findOnly ? { data: null } : await admin.from("mailboxes").select("id, status").eq("id", s.mailboxId!).eq("workspace_id", session.workspace.id).eq("user_id", session.userId).maybeSingle();
  if (!findOnly && (!mb || mb.status !== "connected")) return { ok: false, error: e.mailbox };
  const research = decide(await loadAiSettings(session.workspace.id), "research", "search_prospects");
  if (s.adSets.some((a) => a.source === "new") && !research.allowed) return { ok: false, error: t.ws.ai.rules.searchBlocked };
  // Free signup (owner, 2026-11-05): the first payment comes here. The campaign stays saved as a draft.
  const block = await startBlock(session);
  if (block) {
    await saveDraft(s, draftId);
    return { ok: false, error: block === "noPlan" ? e.noPlan : e.noCredit, needsCredit: true };
  }

  // Openings for every audience before anything starts (the writer needs them).
  const adSets: AdSet[] = [];
  for (const a of s.adSets) {
    if (a.angleA.trim() || findOnly) { adSets.push(a); continue; }
    const r = await approachFor(session, s, a);
    if (!r) return { ok: false, error: e.approach };
    adSets.push({ ...a, ...r });
  }
  const state = { ...s, adSets };
  const saved = await saveDraft(state, draftId);
  if (!saved.ok) return saved;
  const id = saved.id;
  const db = await createClient();
  const people = budgetPeople(s, rate);
  await db.from("outreach_campaigns").update({ budget_prospects: people || null, wizard: null, goal: adSets[0].angleA || null, variant_b: adSets[0].angleB || null }).eq("id", id);
  if (!findOnly) await followUpPlan(id, session.workspace.id);

  const finders = adSets.filter((a) => a.source === "new" || a.audienceId);
  const share = finders.length ? Math.floor(people / finders.length) : 0;
  const warnings: string[] = [];
  for (const a of adSets) {
    const w = await startAudience(session, id, a, share, endsAt);
    if (w === "noPlan" || w === "noCredit") return { ok: false, error: w === "noPlan" ? e.noPlan : e.noCredit };
    if (w) warnings.push(w);
  }
  const go = await approveCampaign({ workspaceId: session.workspace.id, userId: session.userId, role: session.role, campaignId: id, mailboxId: mb?.id ?? null, autoReply: !findOnly, launch: true });
  if (!go.ok) return { ok: false, error: e.mailbox };
  await logCampaign(admin, session.workspace.id, id, "note", findOnly
    ? "Yolias is finding the people and companies that match each audience. They are saved in Leads; no one is contacted."
    : s.objective === "meetings" ? "Yolias is finding the first people for each audience. It writes to each one from your mailbox in your hours, answers the replies and books the meetings."
    : "Yolias is finding the first people for each audience. It writes to each one from your mailbox in your hours, answers the replies and sends them your website link.",
    { audiences: adSets.length, people, budget_usd: s.budgetUsd, budget_type: s.budgetType });
  revalidatePath("/campaigns", "layout");
  revalidatePath("/dashboard");
  return { ok: true, id, warnings };
}

/** A launched campaign: its settings and message change; new audiences start; running audiences keep their targeting. */
export async function updateCampaign(id: string, input: unknown): Promise<BuilderResult<{ warnings: string[] }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  const e = t.ag.builder.errors;
  const p = builderSchema.safeParse(input);
  if (!p.success || !z.string().uuid().safeParse(id).success) return { ok: false, error: e.settings };
  const s = p.data;
  const db = await createClient();
  const { data: c } = await db.from("outreach_campaigns").select("id, status, approved_at").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!c || c.status === "archived" || c.status === "completed") return { ok: false, error: e.settings };
  if (!s.name.trim()) return { ok: false, error: e.name };
  const endsAt = zonedIso(s.endDate, s.endTime, s.timezone);
  if (endsAt && Date.parse(endsAt) <= Date.now()) return { ok: false, error: e.dates };
  const { wizard: _w, ...rest } = row(s);
  void _w;
  const mailboxId = s.mailboxId;
  if (mailboxId) {
    const { data: mb } = await createAdminClient().from("mailboxes").select("id, status").eq("id", mailboxId).eq("workspace_id", session.workspace.id).eq("user_id", session.userId).maybeSingle();
    if (!mb || mb.status !== "connected") return { ok: false, error: e.mailbox };
  }
  const { error } = await db.from("outreach_campaigns").update(rest).eq("id", id);
  if (error) return { ok: false, error: e.settings };
  // Changing the mailbox is a sending setting: the server records it, for a launched campaign only, after the ownership check above.
  if (mailboxId && c.approved_at) await createAdminClient().from("outreach_campaigns").update({ mailbox_id: mailboxId, approved_by: session.userId }).eq("id", id).eq("workspace_id", session.workspace.id);
  // New audiences (no group yet with this key's name) start now with an even share of one budget period.
  const { data: groups } = await db.from("audience_groups").select("id, name").eq("campaign_id", id);
  const existing = new Set((groups ?? []).map((g) => g.name));
  const fresh = s.adSets.filter((a) => !existing.has(a.name));
  const warnings: string[] = [];
  if (fresh.length) {
    const rate = await prospectRate(session.workspace.id);
    const share = Math.floor(budgetPeople(s, rate) / Math.max(fresh.length, 1));
    for (const a of fresh) {
      const ready = a.angleA.trim() ? a : { ...a, ...((await approachFor(session, s, a)) ?? {}) };
      const w = await startAudience(session, id, ready as AdSet, share, endsAt);
      if (w === "noPlan" || w === "noCredit") return { ok: false, error: w === "noPlan" ? e.noPlan : e.noCredit };
      if (w) warnings.push(w);
    }
  }
  await logCampaign(createAdminClient(), session.workspace.id, id, "note", fresh.length ? `Settings changed; ${fresh.length} new ${fresh.length === 1 ? "audience" : "audiences"} started.` : "Settings changed.", { by: session.userId });
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return { ok: true, warnings };
}
