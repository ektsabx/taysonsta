import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import type { Scope } from "@/lib/bos/permissions";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

export type Meeting = Tables<"meetings">;

export interface MeetingInput {
  title: string;
  lead_id: string | null;
  deal_id: string | null;
  client_id: string | null;
  contact_id: string | null;
  start_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
  attendee_user_ids: string[];
  attendee_contact_ids: string[];
  attendee_emails: string[];
}

function links(m: Pick<Meeting, "lead_id" | "deal_id" | "client_id" | "contact_id">) {
  return [
    { type: "lead", id: m.lead_id },
    { type: "deal", id: m.deal_id },
    { type: "client", id: m.client_id },
    { type: "contact", id: m.contact_id },
  ];
}

function primary(m: Meeting): { type: string; id: string } {
  if (m.lead_id) return { type: "lead", id: m.lead_id };
  if (m.deal_id) return { type: "deal", id: m.deal_id };
  if (m.client_id) return { type: "client", id: m.client_id };
  return { type: "meeting", id: m.id };
}

export async function scheduleMeeting(bos: BosUser, input: MeetingInput) {
  const start = new Date(input.start_at);
  if (Number.isNaN(start.getTime())) throw new ValidationError("موعد غير صالح.", { start_at: "غير صالح" });

  // Derive the account from linked lead/deal so the account 360 sees it.
  let clientId = input.client_id;
  if (!clientId && input.deal_id) clientId = (await db().from("deals").select("client_id").eq("id", input.deal_id).maybeSingle()).data?.client_id ?? null;
  if (!clientId && input.lead_id) clientId = (await db().from("leads").select("client_id").eq("id", input.lead_id).maybeSingle()).data?.client_id ?? null;

  const { data: meeting, error } = await db()
    .from("meetings")
    .insert({
      title: input.title,
      lead_id: input.lead_id,
      deal_id: input.deal_id,
      client_id: clientId,
      contact_id: input.contact_id,
      organizer_id: bos.userId,
      start_at: start.toISOString(),
      duration_minutes: input.duration_minutes,
      meeting_link: input.meeting_link,
      location: input.location,
      notes: input.notes,
      created_by: bos.userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  const attendees = [
    ...new Set([bos.userId, ...input.attendee_user_ids]),
  ].map((user_id) => ({ meeting_id: meeting.id, user_id, response: user_id === bos.userId ? "accepted" : "pending" }));
  const contacts = [...new Set([...(input.contact_id ? [input.contact_id] : []), ...input.attendee_contact_ids])].map((contact_id) => ({ meeting_id: meeting.id, contact_id }));
  const emails = input.attendee_emails.filter((e) => /.+@.+/.test(e)).map((email) => ({ meeting_id: meeting.id, email }));
  if (attendees.length) await db().from("meeting_attendees").insert(attendees);
  if (contacts.length) await db().from("meeting_attendees").insert(contacts);
  if (emails.length) await db().from("meeting_attendees").insert(emails);

  // Timeline: a meeting is also a communication activity on the linked record.
  const p = primary(meeting);
  await emitEvent({
    type: "meeting.scheduled",
    entityType: p.type,
    entityId: p.id,
    summary: `Meeting scheduled: ${meeting.title} (${start.toISOString().slice(0, 16).replace("T", " ")} UTC)`,
    payload: { meeting_id: meeting.id, deal_id: meeting.deal_id, assignee_user_id: bos.userId, start_at: meeting.start_at },
    links: [...links(meeting), { type: "meeting", id: meeting.id }].filter((l) => !(l.type === p.type && l.id === p.id)),
    actorId: bos.userId,
  });
  for (const a of attendees.filter((x) => x.user_id !== bos.userId)) {
    await emitEvent({
      type: "meeting.invited",
      entityType: "meeting",
      entityId: meeting.id,
      summary: `You were invited to: ${meeting.title}`,
      payload: { assignee_user_id: a.user_id },
      actorId: bos.userId,
      dedupeKey: `meeting.invited:${meeting.id}:${a.user_id}`,
    });
  }
  return meeting;
}

export async function completeMeeting(bos: BosUser, id: string, outcome: string, nextAction: string | null, notes: string | null) {
  const { data: meeting } = await db().from("meetings").select("*").eq("id", id).maybeSingle();
  if (!meeting) throw new NotFoundError();
  if (meeting.status === "completed") throw new ValidationError("تم تسجيل نتيجة هذا الاجتماع بالفعل.");
  if (!outcome.trim()) throw new ValidationError("اكتب نتيجة الاجتماع.", { outcome: "مطلوب" });

  await db()
    .from("meetings")
    .update({ status: "completed", outcome, next_action: nextAction, notes: notes ?? meeting.notes })
    .eq("id", id);
  await recordStatus("meeting", id, meeting.status, "completed", bos.userId);

  // Log as a completed meeting activity on the linked record.
  if (meeting.lead_id || meeting.deal_id || meeting.client_id || meeting.contact_id) {
    await db().from("activities").insert({
      type: "meeting",
      title: meeting.title,
      description: `${outcome}${nextAction ? `\nNext: ${nextAction}` : ""}`,
      outcome,
      direction: "outbound",
      lead_id: meeting.lead_id,
      deal_id: meeting.deal_id,
      client_id: meeting.client_id,
      contact_id: meeting.contact_id,
      assigned_to: meeting.organizer_id,
      status: "completed",
      completed_at: nowIso(),
      created_by: bos.userId,
    });
  }

  const p = primary(meeting);
  await emitEvent({
    type: "meeting.completed",
    entityType: "meeting",
    entityId: id,
    summary: `Meeting held: ${meeting.title} — ${outcome}`,
    payload: {
      meeting_id: id,
      title: meeting.title,
      next_action: nextAction,
      organizer_id: meeting.organizer_id,
      assignee_user_id: meeting.organizer_id,
      lead_id: meeting.lead_id,
      deal_id: meeting.deal_id,
      client_id: meeting.client_id,
    },
    links: [...links(meeting), { type: p.type, id: p.id }],
    actorId: bos.userId,
  });
}

export async function cancelMeeting(bos: BosUser, id: string, status: "cancelled" | "no_show", reason: string | null) {
  const { data: meeting } = await db().from("meetings").select("*").eq("id", id).maybeSingle();
  if (!meeting) throw new NotFoundError();
  await db().from("meetings").update({ status }).eq("id", id);
  await recordStatus("meeting", id, meeting.status, status, bos.userId, reason);
  await audit({ actorId: bos.userId, action: `meeting.${status}`, entityType: "meeting", entityId: id, reason });
  const p = primary(meeting);
  await emitEvent({ type: `meeting.${status}`, entityType: p.type, entityId: p.id, summary: `Meeting ${status === "no_show" ? "no-show" : "cancelled"}: ${meeting.title}`, links: [{ type: "meeting", id }], actorId: bos.userId });
}

export async function listMeetings(bos: BosUser, scope: Scope, f: { view?: string; q?: string; page?: number }) {
  const pageSize = 30;
  const page = Math.max(1, f.page ?? 1);
  let query = db().from("meetings").select("*, clients(name), leads(name), deals(name)", { count: "exact" });
  if (scope !== "all") {
    const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
    const { data: attending } = await db().from("meeting_attendees").select("meeting_id").in("user_id", users);
    const ids = (attending ?? []).map((a) => a.meeting_id);
    query = ids.length ? query.or(`organizer_id.in.(${users.join(",")}),id.in.(${ids.join(",")})`) : query.in("organizer_id", users);
  }
  const now = nowIso();
  if (f.view === "past") query = query.lt("start_at", now);
  else if (f.view === "needs_outcome") query = query.eq("status", "scheduled").lt("start_at", now);
  else if (f.view !== "all") query = query.gte("start_at", new Date(nowMs() - 2 * 3600_000).toISOString()).eq("status", "scheduled");
  if (f.q) query = query.ilike("title", `%${f.q.replace(/[%_]/g, " ")}%`);
  const ascending = !f.view || f.view === "upcoming";
  const { data, count, error } = await query.order("start_at", { ascending }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listEntityMeetings(filter: { lead_id?: string; deal_id?: string; client_id?: string; contact_id?: string }) {
  let query = db().from("meetings").select("*");
  for (const [k, v] of Object.entries(filter)) if (v) query = query.eq(k, v);
  const { data } = await query.order("start_at", { ascending: false }).limit(100);
  return data ?? [];
}
