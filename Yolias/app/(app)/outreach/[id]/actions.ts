"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { logCampaign } from "@/lib/campaigns/activity";
import { startGroupSearch } from "@/lib/campaigns/group-search";
import { pause as pauseSearch, resume as resumeSearch } from "@/lib/discovery/campaign-control";
import { groupSchema, stepSchema, zonedIso } from "@/lib/campaigns/wizard";
import { members } from "@/lib/campaigns/audience";
import { enrollLeads } from "@/lib/outreach/sequence";
import { cleanCtaUrl } from "@/lib/outreach/aim";
import type { Json } from "@/types/database";

// A campaign's own page (owner, 2026-10-31, D-272): its settings, its audience
// groups (add, pause, resume, archive, duplicate) and each group's sequence.

export type DetailResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };

const settingsInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  objective: z.enum(["leads", "meetings", "opportunities", "new_customers", "reactivate", "promote", "custom"]),
  description: z.string().max(3000).default(""),
  ownerId: z.string().uuid().nullable(),
  ctaUrl: z.string().max(500).default(""),
  budgetType: z.enum(["total", "daily", "monthly"]),
  budgetUsd: z.number().min(0).max(1_000_000),
  startDate: z.string(), startTime: z.string(), endDate: z.string(), endTime: z.string(),
  timezone: z.string().max(64),
  runDays: z.array(z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])).min(1),
  contactFrom: z.string().regex(/^\d{2}:\d{2}$/), contactTo: z.string().regex(/^\d{2}:\d{2}$/),
  dailyLimit: z.number().int().min(1).max(500),
  targetMeetings: z.number().int().min(0).max(1000),
});

export async function updateCampaignSettings(input: z.input<typeof settingsInput>): Promise<DetailResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const p = settingsInput.safeParse(input);
  if (!p.success) return { ok: false, error: t.camp.wizard.errors.settings };
  const s = p.data;
  const startsAt = zonedIso(s.startDate, s.startTime, s.timezone), endsAt = zonedIso(s.endDate, s.endTime, s.timezone);
  if (endsAt && (Date.parse(endsAt) <= Date.now() || (startsAt && Date.parse(endsAt) <= Date.parse(startsAt)))) return { ok: false, error: t.camp.wizard.errors.dates };
  if (s.objective === "promote" && !cleanCtaUrl(s.ctaUrl || null)) return { ok: false, error: t.camp.wizard.errors.link };
  const db = await createClient();
  const { data: c } = await db.from("outreach_campaigns").select("id, status, approved_at").eq("id", s.id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!c || c.status === "archived") return { ok: false, error: t.ws.outreach.errors.notFound };
  const later = Boolean(startsAt && Date.parse(startsAt) > Date.now());
  const status = c.approved_at && (c.status === "active" || c.status === "scheduled") ? (later ? "scheduled" : "active") : c.status;
  const { error } = await db.from("outreach_campaigns").update({
    name: s.name, objective: s.objective, description: s.description || null, owner_id: s.ownerId, aim: s.objective === "promote" ? "sell" : "meeting", cta_url: cleanCtaUrl(s.ctaUrl || null),
    budget_type: s.budgetType, budget_usd: s.budgetUsd, starts_at: startsAt, ends_at: endsAt, timezone: s.timezone, run_days: s.runDays,
    contact_from: s.contactFrom, contact_to: s.contactTo, daily_limit: s.dailyLimit, target_meetings: s.targetMeetings || null, status,
  }).eq("id", s.id);
  if (error) return { ok: false, error: t.camp.wizard.errors.settings };
  await logCampaign(createAdminClient(), session.workspace.id, s.id, "note", "Settings changed.", { by: session.userId });
  revalidatePath(`/outreach/${s.id}`);
  return { ok: true, message: t.camp.perf.saved };
}

/** A new audience group on an existing campaign: its search starts with the prospects given (from the balance), or its list joins. */
export async function addGroup(campaignId: string, group: unknown, prospects: number): Promise<DetailResult<{ id: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  const g = groupSchema.safeParse(group);
  if (!z.string().uuid().safeParse(campaignId).success || !g.success || !g.data.angleA.trim()) return { ok: false, error: t.camp.wizard.errors.audience };
  const db = await createClient();
  const { data: c } = await db.from("outreach_campaigns").select("id, status, ends_at").eq("id", campaignId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!c || c.status === "archived" || c.status === "completed") return { ok: false, error: t.ws.outreach.errors.notFound };
  const x = g.data;
  const { data: row, error } = await db.from("audience_groups").insert({
    workspace_id: session.workspace.id, campaign_id: campaignId, name: x.name, source: x.source, targeting: x.targeting as unknown as Json,
    audience_id: x.audienceId, angle_a: x.angleA, angle_b: x.angleB || null, created_by: session.userId,
  }).select("id").single();
  if (error || !row) return { ok: false, error: t.camp.wizard.errors.settings };
  await db.from("outreach_steps").insert(x.steps.map((st, i) => ({ workspace_id: session.workspace.id, campaign_id: campaignId, audience_group_id: row.id, position: i + 1, delay_days: i === 0 ? 0 : st.delayDays, objective: st.objective as never, instruction: st.instruction || null })));
  if (x.source === "find_new" || x.source === "saved" || x.source === "lookalike") {
    if (prospects < 10) return { ok: false, error: fmt(t.camp.wizard.warnings.budget, { name: x.name }) };
    const r = await startGroupSearch(session, x, prospects, c.ends_at);
    if (r === "noPlan" || r === "noCredit") return { ok: false, error: r === "noPlan" ? t.camp.wizard.errors.noPlan : t.camp.wizard.errors.noCredit };
    if (!r) return { ok: false, error: fmt(t.camp.wizard.warnings.search, { name: x.name }) };
    await db.from("audience_groups").update({ strategy_id: r.strategyId, search_campaign_id: r.searchId }).eq("id", row.id);
  } else {
    const ids = await members(session.workspace.id, x.source, { audienceId: x.audienceId, campaignId: x.fromCampaignId });
    if (ids.length) await enrollLeads(db as never, session.workspace.id, session.userId, campaignId, ids, row.id);
  }
  await logCampaign(createAdminClient(), session.workspace.id, campaignId, "note", `Audience group added: ${x.name}.`, { group: row.id, prospects });
  revalidatePath(`/outreach/${campaignId}`);
  return { ok: true, id: row.id };
}

export async function groupAction(groupId: string, action: "pause" | "resume" | "archive" | "duplicate"): Promise<DetailResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!z.string().uuid().safeParse(groupId).success) return { ok: false, error: t.ws.outreach.errors.notFound };
  const db = await createClient();
  const { data: g } = await db.from("audience_groups").select("*").eq("id", groupId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!g) return { ok: false, error: t.ws.outreach.errors.notFound };
  if (action === "duplicate") {
    const { data: copy } = await db.from("audience_groups").insert({
      workspace_id: g.workspace_id, campaign_id: g.campaign_id, name: `${g.name} (2)`.slice(0, 120), status: "paused", source: g.source, targeting: g.targeting, audience_id: g.audience_id,
      angle_a: g.angle_a, angle_b: g.angle_b, created_by: session.userId,
    }).select("id").single();
    const { data: steps } = await db.from("outreach_steps").select("position, delay_days, objective, instruction").eq("audience_group_id", groupId);
    if (copy && steps?.length) await db.from("outreach_steps").insert(steps.map((s) => ({ ...s, workspace_id: g.workspace_id, campaign_id: g.campaign_id, audience_group_id: copy.id })));
  } else {
    const status = action === "resume" ? "active" : action === "pause" ? "paused" : "archived";
    await db.from("audience_groups").update({ status, updated_at: new Date().toISOString() }).eq("id", groupId);
    // Its search stops finding people while it is paused or archived, and goes on when resumed.
    if (g.search_campaign_id) await (action === "resume" ? resumeSearch(db, g.search_campaign_id) : pauseSearch(db, g.search_campaign_id));
    // Its people stop (or continue) their sequences.
    await db.from("outreach_enrollments").update({ status: action === "resume" ? "active" : "paused" }).eq("audience_group_id", groupId).in("status", action === "resume" ? ["paused"] : ["active"]);
  }
  await logCampaign(createAdminClient(), session.workspace.id, g.campaign_id, "note", `Audience group “${g.name}”: ${action}.`, { group: groupId, by: session.userId });
  revalidatePath(`/outreach/${g.campaign_id}`);
  return { ok: true };
}

export async function saveGroupSteps(groupId: string, steps: unknown): Promise<DetailResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const p = z.array(stepSchema).min(1).max(5).safeParse(steps);
  if (!z.string().uuid().safeParse(groupId).success || !p.success) return { ok: false, error: t.ws.outreach.errors.steps };
  const db = await createClient();
  const { data: g } = await db.from("audience_groups").select("id, campaign_id, workspace_id").eq("id", groupId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!g) return { ok: false, error: t.ws.outreach.errors.notFound };
  await db.from("outreach_steps").delete().eq("audience_group_id", groupId);
  await db.from("outreach_steps").insert(p.data.map((st, i) => ({ workspace_id: g.workspace_id, campaign_id: g.campaign_id, audience_group_id: groupId, position: i + 1, delay_days: i === 0 ? 0 : st.delayDays, objective: st.objective as never, instruction: st.instruction || null })));
  revalidatePath(`/outreach/${g.campaign_id}`);
  return { ok: true, message: t.camp.perf.saved };
}
