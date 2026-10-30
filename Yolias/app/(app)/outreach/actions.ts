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
import { searchTargets } from "@/services/prospects";
import { approveCampaign, setCampaignRun } from "@/lib/outreach/execute";
import { memberMailboxes } from "@/lib/mailbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { AIMS, cleanCtaUrl } from "@/lib/outreach/aim";
import type { CampaignAim } from "@/types/acquisition";

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
  /** What the campaign is for and the link the agent offers (D-253). */
  aim: z.enum(AIMS).optional(),
  /** A second angle for the first email (A/B test, D-268); empty = no test. */
  variant_b: z.string().trim().max(1000).nullable().optional(),
  cta_url: z.string().trim().max(500).nullable().optional(),
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
    // Email only (D-239): Yolias sends from the member's mailbox; no LinkedIn or chat messages.
    name: c.name, goal: c.goal || null, description: c.description || null, channel: "email" as never, language: c.language, tone: c.tone as never,
    customer_profile_id: c.customer_profile_id, offer_id: c.offer_id,
    ...(c.aim ? { aim: c.aim } : {}), ...(c.cta_url !== undefined ? { cta_url: cleanCtaUrl(c.cta_url) } : {}),
    ...(c.variant_b !== undefined ? { variant_b: c.variant_b || null } : {}),
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
    const targets = await searchTargets(session.workspace.id, c.source_campaign_id);
    const launched = await launchCampaign(id!, targets);
    revalidatePath("/outreach", "layout");
    revalidatePath("/inbox");
    return launched.ok ? { ok: true, id: id!, message: launched.message } : { ok: true, id: id!, message: launched.error };
  }
  revalidatePath("/outreach", "layout");
    revalidatePath("/inbox");
  return { ok: true, id: id! };
}

/**
 * Puts the prospects in a new campaign (CRM → enrollment). The campaign page
 * then writes each person's email live (writeNextEmails) and the member
 * approves sending from their mailbox (D-239).
 */
export async function launchCampaign(campaignId: string, targets: LeadTarget[]): Promise<OutreachResult> {
  const t = (await getDictionary()).ws.outreach;
  if (!targets.length) return { ok: false, error: t.errors.noProspects };
  return addProspectsToCampaign(campaignId, targets);
}

/**
 * The campaign page writes the first email of each person, a couple at a
 * time, while the member watches (D-239). Writing needs the member's
 * connected mailbox. People without an email address leave the campaign.
 */
export async function writeNextEmails(campaignId: string): Promise<OutreachResult<{ prepared: number; remaining: number }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const o = t.ws.outreach;
  if (!uuid.safeParse(campaignId).success) return { ok: false, error: o.errors.notFound };
  if (!(await memberMailboxes(session.workspace.id, session.userId)).some((m) => m.status === "connected")) return { ok: false, error: o.workspace.noMailbox };
  const db = await createClient();
  const { data: camp } = await db.from("outreach_campaigns").select("id, status").eq("id", campaignId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!camp || camp.status === "archived") return { ok: false, error: o.errors.notFound };
  const [{ data: enr }, { data: written }] = await Promise.all([
    db.from("outreach_enrollments").select("id").eq("campaign_id", campaignId).eq("status", "active").eq("current_step", 0).order("created_at").limit(500),
    db.from("outreach_messages").select("enrollment_id").eq("outreach_campaign_id", campaignId).eq("step_position", 1).eq("direction", "outbound").neq("status", "canceled").limit(1000),
  ]);
  const done = new Set((written ?? []).map((m) => m.enrollment_id));
  const todo = (enr ?? []).filter((e) => !done.has(e.id));
  let prepared = 0, handled = 0;
  for (const e of todo.slice(0, 2)) {
    handled++;
    const r = await prepareNextStep(session.workspace.id, session.userId, e.id, "user");
    if (r.ok) { prepared++; continue; }
    if (r.error === "no_email" || r.error === "do_not_contact" || r.error === "suppressed") {
      await createAdminClient().from("outreach_enrollments").update({ status: "stopped", stop_reason: r.error, next_step_at: null }).eq("id", e.id).eq("status", "active");
      continue;
    }
    if (r.error === "not_configured" || r.error === "denied") {
      const reason = r.error in t.ws.messages.prepareErrors ? t.ws.messages.prepareErrors[r.error as keyof typeof t.ws.messages.prepareErrors] : t.outreach.errors[r.error as keyof typeof t.outreach.errors];
      return { ok: false, error: reason ?? t.ws.common.error };
    }
  }
  revalidatePath(`/outreach/${campaignId}`);
  return { ok: true, prepared, remaining: Math.max(0, todo.length - handled) };
}

/** Selected prospects → a new campaign with the usual two steps, started at once (Prospects → Send). */
export async function quickCampaign(input: { name: string; channel: string; targets: LeadTarget[]; aim?: CampaignAim; ctaUrl?: string | null }): Promise<OutreachResult<{ id: string }>> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.outreach;
  const settings = await loadAiSettings(session.workspace.id);
  // The aim and link default to the workspace's last campaign (D-253).
  const { data: last } = await (await createClient()).from("outreach_campaigns").select("aim, cta_url").eq("workspace_id", session.workspace.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const saved = await saveOutreachCampaign({
    name: input.name, goal: "", description: "", channel: "email" as never, language: session.profile.language === "ar" ? "ar" : "en", tone: "direct",
    customer_profile_id: null, offer_id: null,
    aim: input.aim ?? ((last?.aim as CampaignAim | undefined) ?? "meeting"), cta_url: input.ctaUrl !== undefined ? input.ctaUrl : last?.cta_url ?? null,
    steps: [{ delay_days: 0, objective: "introduction", instruction: "" }, { delay_days: 3, objective: "follow_up", instruction: "" }].slice(0, Math.max(1, settings.limits.max_messages_per_lead)) as never,
  });
  if (!saved.ok) return saved;
  const launched = await launchCampaign(saved.id, input.targets);
  if (!launched.ok) return { ok: false, error: launched.error };
  // The first email is written now, so the approval shows exactly what goes out;
  // the rest are written by the server after approval, with the site closed (D-253).
  await writeSample(session.workspace.id, session.userId, saved.id);
  return { ok: true, id: saved.id, message: launched.message ?? t.started };
}

async function writeSample(workspaceId: string, userId: string, campaignId: string) {
  const { data: first } = await createAdminClient().from("outreach_enrollments").select("id, lead:sales_leads!inner(email)").eq("campaign_id", campaignId).eq("status", "active").eq("current_step", 0)
    .not("lead.email", "is", null).order("created_at").limit(1).maybeSingle();
  if (first) await prepareNextStep(workspaceId, userId, first.id, "user").catch(() => null);
}

/**
 * Changes what the campaign is for (meeting / sell) and its link
 * before it starts. Unsent first emails are written again for the new aim.
 */
export async function setCampaignAim(campaignId: string, aim: CampaignAim, ctaUrl: string | null): Promise<OutreachResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.outreach;
  if (!uuid.safeParse(campaignId).success || !(AIMS as readonly string[]).includes(aim)) return { ok: false, error: t.errors.notFound };
  const link = cleanCtaUrl(ctaUrl);
  if (ctaUrl && ctaUrl.trim() && !link) return { ok: false, error: t.launch.badLink };
  const db = await createClient();
  const { data: c } = await db.from("outreach_campaigns").update({ aim, cta_url: link }).eq("id", campaignId).eq("workspace_id", session.workspace.id).neq("status", "archived").select("id, approved_at").maybeSingle();
  if (!c) return { ok: false, error: t.errors.notFound };
  if (!c.approved_at) {
    const admin = createAdminClient();
    const { data: drafts } = await admin.from("outreach_messages").update({ status: "canceled" }).eq("outreach_campaign_id", campaignId).eq("direction", "outbound").in("status", ["draft", "approved"]).select("id");
    if (drafts?.length) await writeSample(session.workspace.id, session.userId, campaignId);
  }
  revalidatePath("/inbox");
  revalidatePath(`/outreach/${campaignId}`);
  return { ok: true, message: t.launch.aimSaved };
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
    revalidatePath("/inbox");
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
    revalidatePath("/inbox");
  revalidatePath("/inbox");
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
    revalidatePath("/inbox");
  revalidatePath("/inbox");
  return { ok: true, message: enrollMessage(t, r) };
}

/** The campaign wizard (D-256): everyone one search found joins the campaign (its people, and companies with no person listed). */
export async function addSearchToCampaign(campaignId: string, searchId: string): Promise<OutreachResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.outreach;
  if (!uuid.safeParse(campaignId).success || !uuid.safeParse(searchId).success) return { ok: false, error: t.errors.notFound };
  const targets = await searchTargets(session.workspace.id, searchId);
  return launchCampaign(campaignId, targets);
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
    revalidatePath("/inbox");
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
  revalidatePath("/inbox");
  if (!prepared && blocking) return { ok: false, error: reasonText(blocking) };
  // The most common reason a lead was skipped (e.g. no email for an email campaign).
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
  return { ok: true, message: [fmt(t.ws.outreach.prepared, { count: prepared }), skipped ? `${fmt(t.ws.outreach.prepareSkipped, { count: skipped })}${top ? `: ${reasonText(top[0])}` : ""}` : null].filter(Boolean).join(" ") };
}

/**
 * The member approves running the campaign (D-229): from their connected
 * mailbox (Yolias sends the sequence) or, without one, in manual mode (Yolias
 * prepares, they send). Explicit: nothing is sent before this.
 */
export async function approveOutreach(campaignId: string, mailboxId: string | null, autoReply: boolean): Promise<OutreachResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.outreach;
  if (!uuid.safeParse(campaignId).success || (mailboxId !== null && !uuid.safeParse(mailboxId).success)) return { ok: false, error: t.errors.notFound };
  const r = await approveCampaign({ workspaceId: session.workspace.id, userId: session.userId, role: session.role, campaignId, mailboxId, autoReply: autoReply === true });
  if (!r.ok) return { ok: false, error: t.launch.errors[r.error] };
  revalidatePath("/outreach", "layout");
    revalidatePath("/inbox");
  return { ok: true, message: mailboxId ? t.launch.started : t.launch.startedManual };
}

export async function runOutreach(campaignId: string, action: "pause" | "resume" | "cancel"): Promise<OutreachResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws.outreach;
  if (!uuid.safeParse(campaignId).success || !["pause", "resume", "cancel"].includes(action)) return { ok: false, error: t.errors.notFound };
  if (!(await setCampaignRun(session.workspace.id, campaignId, action))) return { ok: false, error: t.errors.notFound };
  revalidatePath("/outreach", "layout");
    revalidatePath("/inbox");
  return { ok: true };
}
