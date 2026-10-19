"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { addLeads, leadsCreated, type LeadTarget } from "@/lib/crm";
import { enrollLeads, prepareNextStep, type EnrollResult } from "@/lib/outreach/sequence";
import { channels, isMessageLanguage, objectives, tones } from "@/lib/outreach/channels";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import type { OutreachCampaignStatus } from "@/types/database";
import { parseFilters, selectItems } from "@/services/prospects";

// Outreach campaigns (D-193): create / edit with steps, add and remove leads,
// prepare drafts, change status. All as the member (RLS); drafting checks
// Rules & Permissions in lib/outreach/sequence.ts.

export type OutreachResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };
const uuid = z.string().uuid();

const campaignInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  goal: z.string().trim().max(1000).optional().default(""),
  description: z.string().trim().max(3000).optional().default(""),
  channel: z.enum(channels as [string, ...string[]]),
  language: z.string().refine(isMessageLanguage),
  tone: z.enum(tones as [string, ...string[]]),
  customer_profile_id: z.string().uuid().nullable(),
  offer_id: z.string().uuid().nullable(),
  steps: z.array(z.object({
    delay_days: z.number().int().min(0).max(90),
    objective: z.enum(objectives as [string, ...string[]]),
    instruction: z.string().trim().max(1000).optional().default(""),
  })).min(1).max(10),
  /** New campaigns only: start from a search campaign — its prospects join, drafts are prepared (owner brief 2026-10-19). */
  source_campaign_id: z.string().uuid().nullable().optional(),
});

export async function saveOutreachCampaign(input: z.input<typeof campaignInput>): Promise<OutreachResult<{ id: string }>> {
  const session = await requireSession();
  const e = (await getDictionary()).ws.outreach.errors;
  const p = campaignInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues.some((i) => i.path[0] === "steps") ? e.steps : e.name };
  const c = p.data;
  const limits = (await loadAiSettings(session.workspace.id)).limits;
  const steps = c.steps.slice(0, limits.max_messages_per_lead);
  const db = await createClient();
  const row = {
    name: c.name, goal: c.goal || null, description: c.description || null, channel: c.channel as never, language: c.language, tone: c.tone as never,
    customer_profile_id: c.customer_profile_id, offer_id: c.offer_id,
  };
  let id = c.id;
  if (id) {
    const { data, error } = await db.from("outreach_campaigns").update(row).eq("id", id).eq("workspace_id", session.workspace.id).neq("status", "archived").select("id").maybeSingle();
    if (error || !data) return { ok: false, error: e.notFound };
  } else {
    const { data, error } = await db.from("outreach_campaigns").insert({ ...row, workspace_id: session.workspace.id, created_by: session.userId }).select("id").single();
    if (error || !data) return { ok: false, error: e.name };
    id = data.id;
  }
  // Steps are replaced as a whole; messages already prepared keep their step number.
  await db.from("outreach_steps").delete().eq("campaign_id", id);
  const { error: stepsError } = await db.from("outreach_steps").insert(steps.map((s, i) => ({
    workspace_id: session.workspace.id, campaign_id: id!, position: i + 1, delay_days: i === 0 ? 0 : s.delay_days, objective: s.objective as never, instruction: s.instruction || null,
  })));
  if (stepsError) return { ok: false, error: e.steps };
  if (!c.id && c.source_campaign_id) {
    const { rows } = await selectItems(session.workspace.id, parseFilters({ campaign: c.source_campaign_id }), "all");
    const targets = rows.map((i) => ({ kind: i.kind === "person" ? ("person" as const) : ("company" as const), id: i.row.id }));
    const launched = await launchCampaign(id!, targets);
    revalidatePath("/outreach", "layout");
    return launched.ok ? { ok: true, id: id!, message: launched.message } : { ok: true, id: id!, message: launched.error };
  }
  revalidatePath("/outreach", "layout");
  return { ok: true, id: id! };
}

/**
 * Starts a campaign in one go (owner brief 2026-10-19): the prospects join it
 * (CRM → enrollment), it becomes active, and the first drafts are prepared so
 * they're ready to send. Sending stays the member's (D-193): Yolias has no
 * mailbox connected, so "sent" is confirmed by the member.
 */
export async function launchCampaign(campaignId: string, targets: LeadTarget[]): Promise<OutreachResult> {
  const t = (await getDictionary()).ws.outreach;
  if (!targets.length) return { ok: false, error: t.errors.noProspects };
  const added = await addProspectsToCampaign(campaignId, targets);
  if (!added.ok) return added;
  const active = await setOutreachStatus(campaignId, "active");
  if (!active.ok) return active;
  const drafts = await prepareCampaignDrafts(campaignId);
  return { ok: true, message: [added.message, drafts.ok ? drafts.message : drafts.error].filter(Boolean).join(" ") };
}

/** Selected prospects → a new campaign with the usual two steps, started at once (Prospects → Send). */
export async function quickCampaign(input: { name: string; channel: string; targets: LeadTarget[] }): Promise<OutreachResult<{ id: string }>> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.outreach;
  const settings = await loadAiSettings(session.workspace.id);
  const saved = await saveOutreachCampaign({
    name: input.name, goal: "", description: "", channel: input.channel as never, language: session.profile.language === "ar" ? "ar" : "en", tone: "direct",
    customer_profile_id: null, offer_id: null,
    steps: [{ delay_days: 0, objective: "introduction", instruction: "" }, { delay_days: 3, objective: "follow_up", instruction: "" }].slice(0, Math.max(1, settings.limits.max_messages_per_lead)) as never,
  });
  if (!saved.ok) return saved;
  const launched = await launchCampaign(saved.id, input.targets);
  if (!launched.ok) return { ok: false, error: launched.error };
  return { ok: true, id: saved.id, message: launched.message ?? t.started };
}

export async function setOutreachStatus(id: string, status: OutreachCampaignStatus): Promise<OutreachResult> {
  const session = await requireSession();
  const e = (await getDictionary()).ws.outreach.errors;
  if (!uuid.safeParse(id).success || !["draft", "active", "paused", "archived"].includes(status)) return { ok: false, error: e.notFound };
  const db = await createClient();
  const { data, error } = await db.from("outreach_campaigns").update({ status }).eq("id", id).eq("workspace_id", session.workspace.id).neq("status", "archived").select("id").maybeSingle();
  if (error || !data) return { ok: false, error: e.notFound };
  if (status === "archived") {
    await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: "campaign_archived", next_step_at: null }).eq("campaign_id", id).in("status", ["active", "paused"]);
  }
  revalidatePath("/outreach", "layout");
  return { ok: true };
}

function enrollMessage(t: Awaited<ReturnType<typeof getDictionary>>["ws"]["outreach"], r: EnrollResult): string {
  return [fmt(t.enrolled, { count: r.added }), ...Object.entries(r.skipped).map(([k, n]) => fmt(t.skipped[k as keyof typeof t.skipped], { count: n ?? 0 }))].join(" · ");
}

/** CRM leads → campaign. */
export async function enrollInCampaign(campaignId: string, leadIds: string[]): Promise<OutreachResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.outreach;
  const ids = (leadIds ?? []).filter((x) => uuid.safeParse(x).success);
  if (!uuid.safeParse(campaignId).success || !ids.length) return { ok: false, error: t.errors.notFound };
  const r = await enrollLeads(await createClient(), session.workspace.id, session.userId, campaignId, ids);
  if (!r) return { ok: false, error: t.errors.archived };
  revalidatePath("/outreach", "layout");
  revalidatePath("/crm");
  return { ok: true, message: enrollMessage(t, r) };
}

/** Prospects (people / companies) → CRM (one lead each, never duplicated) → campaign. */
export async function addProspectsToCampaign(campaignId: string, targets: LeadTarget[]): Promise<OutreachResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.outreach;
  const valid = (targets ?? []).filter((x) => (x?.kind === "person" || x?.kind === "company") && uuid.safeParse(x.id).success).slice(0, 500);
  if (!uuid.safeParse(campaignId).success || !valid.length) return { ok: false, error: t.errors.notFound };
  const db = await createClient();
  const before = new Set(((await db.from("sales_leads").select("id").eq("workspace_id", session.workspace.id).limit(10000)).data ?? []).map((l) => l.id));
  const { ids } = await addLeads(db, valid, "search");
  await leadsCreated(session.workspace.id, ids.filter((id) => !before.has(id)));
  const r = await enrollLeads(db, session.workspace.id, session.userId, campaignId, ids);
  if (!r) return { ok: false, error: t.errors.archived };
  revalidatePath("/outreach", "layout");
  revalidatePath("/crm");
  return { ok: true, message: enrollMessage(t, r) };
}

/** Removes a lead from a campaign: deleted when nothing was sent yet, otherwise stopped (history kept). */
export async function removeEnrollment(enrollmentId: string): Promise<OutreachResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  if (!uuid.safeParse(enrollmentId).success) return { ok: false, error: t.common.notFound };
  const db = await createClient();
  const { data: e } = await db.from("outreach_enrollments").select("id, current_step").eq("id", enrollmentId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!e) return { ok: false, error: t.common.notFound };
  await db.from("outreach_messages").update({ status: "canceled" }).eq("enrollment_id", e.id).eq("status", "draft");
  const { error } = e.current_step === 0
    ? await db.from("outreach_enrollments").delete().eq("id", e.id)
    : await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: "removed", next_step_at: null }).eq("id", e.id);
  if (error) return { ok: false, error: t.common.error };
  revalidatePath("/outreach", "layout");
  return { ok: true };
}

/** Outreach / Follow-up Agent: prepares the next draft for active leads (at most 10 per click). */
export async function prepareCampaignDrafts(campaignId: string): Promise<OutreachResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!uuid.safeParse(campaignId).success) return { ok: false, error: t.ws.outreach.errors.notFound };
  const db = await createClient();
  const { data: enrollments } = await db.from("outreach_enrollments").select("id").eq("campaign_id", campaignId).eq("workspace_id", session.workspace.id).eq("status", "active").order("created_at").limit(200);
  let prepared = 0, skipped = 0;
  const reasons = new Map<string, number>();
  let blocking: string | null = null;
  for (const e of enrollments ?? []) {
    if (prepared >= 10) break;
    const r = await prepareNextStep(session.workspace.id, session.userId, e.id, "user");
    if (r.ok) { prepared++; continue; }
    skipped++;
    reasons.set(r.error, (reasons.get(r.error) ?? 0) + 1);
    if (r.error === "not_configured" || r.error === "denied") { blocking = r.error; break; }
  }
  const reasonText = (key: string) => key in t.ws.messages.prepareErrors
    ? t.ws.messages.prepareErrors[key as keyof typeof t.ws.messages.prepareErrors]
    : t.outreach.errors[key as keyof typeof t.outreach.errors] ?? t.ws.common.error;
  revalidatePath("/outreach", "layout");
  revalidatePath("/inbox");
  if (!prepared && blocking) return { ok: false, error: reasonText(blocking) };
  // The most common reason a lead was skipped (e.g. no email for an email campaign).
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
  return { ok: true, message: [fmt(t.ws.outreach.prepared, { count: prepared }), skipped ? `${fmt(t.ws.outreach.prepareSkipped, { count: skipped })}${top ? ` — ${reasonText(top[0])}` : ""}` : null].filter(Boolean).join(" ") };
}
