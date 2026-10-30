"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { changeStage, meetingChanged } from "@/lib/crm";
import { meetingBrief } from "@/lib/agents/meeting";
import { cancelMeeting, ensureBookingPage } from "@/lib/meetings";
import { DAYS, isTime } from "@/lib/meetings/availability";
import { isValidTimeZone } from "@/lib/regions";
import type { MeetingStatus } from "@/types/database";

// Meetings (D-267): the member's booking page settings and their bookings.
type R = { ok: true } | { ok: false; error: string };

const range = z.tuple([z.string().refine(isTime), z.string().refine(isTime)]).refine(([a, b]) => a < b);
const pageInput = z.object({
  enabled: z.boolean(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/),
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().max(300),
  description: z.string().trim().max(500),
  duration_min: z.number().int().min(10).max(240),
  timezone: z.string().refine(isValidTimeZone),
  buffer_min: z.number().int().min(0).max(120),
  min_notice_hours: z.number().int().min(0).max(336),
  window_days: z.number().int().min(1).max(90),
  hours: z.object(Object.fromEntries(DAYS.map((d) => [d, z.array(range).max(3)])) as Record<(typeof DAYS)[number], z.ZodArray<typeof range>>),
});

export async function saveBookingPage(input: z.input<typeof pageInput>): Promise<R> {
  const session = await requireSession();
  const t = (await getDictionary()).meetings.errors;
  const p = pageInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.path[0] === "slug" ? t.slug : t.invalid };
  await ensureBookingPage(session.userId, session.workspace.id, session.profile.full_name, session.email, session.profile.timezone ?? null, session.profile.language);
  const { error } = await createAdminClient().from("booking_pages").update({ ...p.data, location: p.data.location || null, description: p.data.description || null }).eq("user_id", session.userId);
  if (error) return { ok: false, error: error.code === "23505" ? t.slugTaken : t.invalid };
  revalidatePath("/meetings");
  return { ok: true };
}

export async function setMeetingStatus(id: string, status: MeetingStatus): Promise<R> {
  const session = await requireSession();
  const t = (await getDictionary()).meetings.errors;
  if (!z.string().uuid().safeParse(id).success || !["scheduled", "completed", "canceled", "no_show"].includes(status)) return { ok: false, error: t.invalid };
  if (status === "canceled") {
    const ok = await cancelMeeting({ id, userId: session.userId });
    revalidatePath("/meetings");
    return ok ? { ok: true } : { ok: false, error: t.invalid };
  }
  const db = await createClient();
  const { data: old } = await db.from("sales_meetings").select("status, lead_id").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!old) return { ok: false, error: t.invalid };
  const { data: saved } = await db.from("sales_meetings").update({ status }).eq("id", id).select("id, lead_id, status").single();
  if (!saved) return { ok: false, error: t.invalid };
  await meetingChanged(db, session.workspace.id, saved, old.status, "user");
  revalidatePath("/meetings");
  revalidatePath("/inbox");
  return { ok: true };
}

/** A meeting the member arranged in a conversation (D-268): the lead, the time and the place or link. */
export async function addMeeting(input: { leadId: string; start: string; minutes: number; place: string }): Promise<R> {
  const session = await requireSession();
  const t = (await getDictionary()).meetings.errors;
  const p = z.object({ leadId: z.string().uuid(), start: z.string().refine((v) => !Number.isNaN(Date.parse(v))), minutes: z.number().int().min(10).max(480), place: z.string().trim().max(300) }).safeParse(input);
  if (!p.success) return { ok: false, error: t.invalid };
  const db = await createClient();
  const { data: lead } = await db.from("sales_leads").select("id, name").eq("id", p.data.leadId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!lead) return { ok: false, error: t.invalid };
  const starts = new Date(p.data.start).toISOString();
  const place = p.data.place || null;
  const url = place && /^https?:\/\//i.test(place) ? place : null;
  const { data: saved, error } = await db.from("sales_meetings").insert({
    workspace_id: session.workspace.id, lead_id: lead.id, title: lead.name.slice(0, 200), starts_at: starts, ends_at: new Date(Date.parse(starts) + p.data.minutes * 60_000).toISOString(),
    url, location: url ? null : place, status: "scheduled", source: "manual", created_by: session.userId, host_id: session.userId,
  }).select("id, lead_id, status").single();
  if (error?.code === "23505") return { ok: false, error: t.taken };
  if (error || !saved) return { ok: false, error: t.invalid };
  await meetingChanged(db, session.workspace.id, saved, null, "user");
  revalidatePath("/meetings");
  return { ok: true };
}

/** A short brief before the meeting: who they are, the conversation so far, what to ask (Meeting Agent). */
export async function meetingBriefAction(meetingId: string): Promise<{ ok: true; brief: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!z.string().uuid().safeParse(meetingId).success) return { ok: false, error: t.meetings.errors.invalid };
  const { data: own } = await (await createClient()).from("sales_meetings").select("id").eq("id", meetingId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!own) return { ok: false, error: t.meetings.errors.invalid };
  const r = await meetingBrief(session.workspace.id, session.userId, meetingId, session.profile.language === "ar" ? "ar" : "en");
  if (!r.ok) return { ok: false, error: r.error === "not_configured" ? t.outreach.errors.not_configured : t.meetings.errors.invalid };
  return { ok: true, brief: r.brief };
}

/**
 * What came of it (D-268): the lead became a customer, or didn't (and why).
 * Asked after a meeting (Meetings) and, for purchase campaigns, in the
 * conversation. Won and lost deals guide the next searches (lib/crm/outcomes.ts).
 */
export async function setOutcome(leadId: string, won: boolean, reason?: string | null, meetingId?: string | null): Promise<R> {
  const session = await requireSession();
  const t = (await getDictionary()).meetings.errors;
  if (!z.string().uuid().safeParse(leadId).success) return { ok: false, error: t.invalid };
  const db = await createClient();
  if (meetingId && z.string().uuid().safeParse(meetingId).success) {
    const { data: m } = await db.from("sales_meetings").select("id, lead_id, status").eq("id", meetingId).eq("workspace_id", session.workspace.id).maybeSingle();
    if (m && m.status === "scheduled") {
      const { data: saved } = await db.from("sales_meetings").update({ status: "completed" }).eq("id", m.id).select("id, lead_id, status").single();
      if (saved) await meetingChanged(db, session.workspace.id, saved, "scheduled", "user");
    }
  }
  const r = await changeStage(db, session.workspace.id, leadId, won ? "closed" : "lost", "user");
  if (!r.ok) return { ok: false, error: t.invalid };
  if (!won && reason) await db.from("sales_leads").update({ lost_reason: reason.slice(0, 300) }).eq("id", leadId);
  revalidatePath("/meetings");
  revalidatePath("/inbox");
  revalidatePath("/analytics");
  return { ok: true };
}
