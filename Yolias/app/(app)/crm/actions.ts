"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTeam, requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { addLeads, changeStage, leadsCreated, meetingChanged, type LeadTarget } from "@/lib/crm";
import { meetingBrief } from "@/lib/agents/meeting";
import { STAGES } from "@/lib/automations/schema";
import type { LeadStage, MeetingStatus } from "@/types/database";

// CRM actions (D-195). Members act through their own client (RLS); the
// database records every change in the lead's history.

export type CrmResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.string().uuid();
const refresh = (leadId?: string) => {
  revalidatePath("/crm");
  revalidatePath("/inbox");
  if (leadId) revalidatePath(`/crm/${leadId}`);
};

/** Prospects → CRM. People or companies already in the CRM keep their single lead.
 *  Adding by hand is the member choosing the deal, so new ones enter the CRM
 *  as Interested (the CRM shows deals only, owner 2026-10-21). */
export async function addToCrm(targets: LeadTarget[]): Promise<CrmResult<{ added: number; existing: number; ids: string[]; message: string }>> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  const valid = (targets ?? []).filter((x) => (x?.kind === "person" || x?.kind === "company") && uuid.safeParse(x.id).success).slice(0, 500);
  if (!valid.length) return { ok: false, error: t.crm.errors.notFound };
  const db = await createClient();
  const before = new Set(((await db.from("sales_leads").select("id").eq("workspace_id", session.workspace.id).limit(10000)).data ?? []).map((l) => l.id));
  const { ids } = await addLeads(db, valid, "search");
  const fresh = ids.filter((id) => !before.has(id));
  await leadsCreated(session.workspace.id, fresh);
  for (const id of fresh) await changeStage(db, session.workspace.id, id, "interested", "user");
  refresh();
  const existing = ids.length - fresh.length;
  const message = [fresh.length ? fmt(t.crm.added, { count: fresh.length }) : null, existing ? fmt(t.crm.alreadyIn, { count: existing }) : null].filter(Boolean).join(" ");
  return { ok: true, added: fresh.length, existing, ids, message };
}

export async function setStage(leadId: string, stage: LeadStage): Promise<CrmResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  if (!uuid.safeParse(leadId).success || !STAGES.includes(stage)) return { ok: false, error: t.crm.errors.notFound };
  const r = await changeStage(await createClient(), session.workspace.id, leadId, stage, "user");
  if (!r.ok) return { ok: false, error: t.crm.errors.notFound };
  refresh(leadId);
  return { ok: true };
}

const leadPatch = z.object({
  deal_value: z.number().min(0).max(1e12).nullable().optional(),
  deal_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  owner_id: z.string().uuid().nullable().optional(),
  customer_profile_id: z.string().uuid().nullable().optional(),
  do_not_contact: z.boolean().optional(),
});

export async function updateLead(leadId: string, patch: z.input<typeof leadPatch>): Promise<CrmResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  const p = leadPatch.safeParse(patch);
  if (!uuid.safeParse(leadId).success) return { ok: false, error: t.crm.errors.notFound };
  if (!p.success) return { ok: false, error: p.error.issues.some((i) => i.path[0] === "deal_currency") ? t.crm.errors.currency : t.crm.errors.value };
  const db = await createClient();
  if (p.data.owner_id) {
    const { data: member } = await db.from("workspace_members").select("user_id").eq("workspace_id", session.workspace.id).eq("user_id", p.data.owner_id).maybeSingle();
    if (!member) return { ok: false, error: t.common.error };
  }
  const { data, error } = await db.from("sales_leads").update(p.data).eq("id", leadId).eq("workspace_id", session.workspace.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: t.common.error };
  refresh(leadId);
  return { ok: true };
}

export async function addNote(leadId: string, body: string): Promise<CrmResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  const text = String(body ?? "").trim().slice(0, 4000);
  if (!text) return { ok: false, error: t.crm.errors.note };
  if (!uuid.safeParse(leadId).success) return { ok: false, error: t.crm.errors.notFound };
  const { error } = await (await createClient()).from("lead_activities").insert({ workspace_id: session.workspace.id, lead_id: leadId, kind: "note", actor_id: session.userId, actor_kind: "user", body: text });
  if (error) return { ok: false, error: t.common.error };
  refresh(leadId);
  return { ok: true };
}

export async function addTask(leadId: string, title: string, dueAt: string | null): Promise<CrmResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  const text = String(title ?? "").trim().slice(0, 300);
  if (!text) return { ok: false, error: t.crm.errors.task };
  const due = dueAt && !Number.isNaN(Date.parse(dueAt)) ? new Date(dueAt).toISOString() : null;
  const { error } = await (await createClient()).from("lead_tasks").insert({ workspace_id: session.workspace.id, lead_id: leadId, title: text, due_at: due, kind: "reminder", created_by: session.userId, assignee_id: session.userId });
  if (error) return { ok: false, error: t.common.error };
  refresh(leadId);
  return { ok: true };
}

export async function setTaskDone(taskId: string, done: boolean): Promise<CrmResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  if (!uuid.safeParse(taskId).success) return { ok: false, error: t.common.notFound };
  const { data, error } = await (await createClient()).from("lead_tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", taskId).eq("workspace_id", session.workspace.id).select("lead_id").maybeSingle();
  if (error || !data) return { ok: false, error: t.common.error };
  refresh(data.lead_id);
  return { ok: true };
}

const meetingInput = z.object({
  id: z.string().uuid().optional(),
  lead_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  starts_at: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  ends_at: z.string().refine((v) => !Number.isNaN(Date.parse(v))).nullable().optional(),
  url: z.string().trim().max(1000).regex(/^https?:\/\/\S+$/i).nullable().optional(),
  status: z.enum(["scheduled", "completed", "canceled", "no_show"]).default("scheduled"),
  notes: z.string().trim().max(6000).nullable().optional(),
});

export async function saveMeeting(input: z.input<typeof meetingInput>): Promise<CrmResult<{ id: string }>> {
  const session = await requireSession();
  const e = (await getDictionary()).ws.crm.meeting.errors;
  const clean = { ...input, url: input.url?.trim() || null, notes: input.notes?.trim() || null, ends_at: input.ends_at || null };
  const p = meetingInput.safeParse(clean);
  if (!p.success) {
    const f = p.error.issues[0]?.path[0];
    return { ok: false, error: f === "title" ? e.title : f === "url" ? e.url : e.time };
  }
  const m = p.data;
  const starts = new Date(m.starts_at).toISOString();
  const ends = m.ends_at ? new Date(m.ends_at).toISOString() : null;
  if (ends && ends < starts) return { ok: false, error: e.end };
  const db = await createClient();
  const row = { title: m.title, starts_at: starts, ends_at: ends, url: m.url ?? null, status: m.status, notes: m.notes ?? null };
  let previous: MeetingStatus | null = null;
  let saved: { id: string; lead_id: string; status: MeetingStatus } | null = null;
  if (m.id) {
    const { data: old } = await db.from("sales_meetings").select("status").eq("id", m.id).eq("workspace_id", session.workspace.id).maybeSingle();
    if (!old) return { ok: false, error: e.title };
    previous = old.status;
    saved = (await db.from("sales_meetings").update(row).eq("id", m.id).select("id, lead_id, status").single()).data;
  } else {
    saved = (await db.from("sales_meetings").insert({ ...row, workspace_id: session.workspace.id, lead_id: m.lead_id, created_by: session.userId }).select("id, lead_id, status").single()).data;
  }
  if (!saved) return { ok: false, error: (await getDictionary()).ws.common.error };
  await meetingChanged(db, session.workspace.id, saved, previous, "user");
  refresh(saved.lead_id);
  return { ok: true, id: saved.id };
}

export async function prepareMeetingBrief(meetingId: string): Promise<CrmResult<{ brief: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!uuid.safeParse(meetingId).success) return { ok: false, error: t.ws.common.notFound };
  // RLS: the member can read this meeting.
  const { data: own } = await (await createClient()).from("sales_meetings").select("lead_id").eq("id", meetingId).maybeSingle();
  if (!own) return { ok: false, error: t.ws.common.notFound };
  const r = await meetingBrief(session.workspace.id, session.userId, meetingId, session.profile.language === "ar" ? "ar" : "en");
  if (!r.ok) return { ok: false, error: r.error === "denied" ? t.ws.messages.prepareErrors.denied : r.error === "not_configured" ? t.outreach.errors.not_configured : t.ws.common.error };
  refresh(own.lead_id);
  return { ok: true, brief: r.brief };
}

/** Approve or reject an agent / automation request (Rules & Permissions → "Needs approval"). */
export async function decideApproval(id: string, approve: boolean): Promise<CrmResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  if (!uuid.safeParse(id).success) return { ok: false, error: t.common.notFound };
  const db = await createClient();
  const { data: pa } = await db.from("agent_pending_actions").select("*").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!pa || pa.status !== "pending" || !pa.lead_id) return { ok: false, error: t.common.notFound };
  const admin = createAdminClient();
  const { data: claimed } = await admin.from("agent_pending_actions").update({ status: approve ? "approved" : "rejected", decided_by: session.userId, decided_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (!claimed) return { ok: false, error: t.common.notFound };
  if (approve && pa.tool === "crm.set_stage") {
    const stage = (pa.input as { stage?: string })?.stage;
    if (stage && (STAGES as readonly string[]).includes(stage)) await changeStage(db, session.workspace.id, pa.lead_id, stage as LeadStage, "user");
  }
  refresh(pa.lead_id);
  return { ok: true };
}

export async function removeLead(leadId: string): Promise<CrmResult> {
  const session = await requireSession();
  const t = (await getDictionary()).ws;
  if (!canManageTeam(session)) return { ok: false, error: t.common.onlyManagers };
  const { error } = await (await createClient()).from("sales_leads").delete().eq("id", leadId).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: t.common.error };
  refresh();
  return { ok: true };
}
