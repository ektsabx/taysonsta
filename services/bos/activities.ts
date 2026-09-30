import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import type { Scope } from "@/lib/bos/permissions";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

export type Activity = Tables<"activities">;
export type ActivityType = Activity["type"];

export const communicationTypes: ActivityType[] = ["call", "email", "whatsapp", "linkedin", "meeting", "client_communication", "note"];

export interface ActivityInput {
  type: ActivityType;
  title: string;
  description: string | null;
  direction: "inbound" | "outbound" | "internal" | null;
  outcome: string | null;
  lead_id: string | null;
  deal_id: string | null;
  client_id: string | null;
  contact_id: string | null;
  project_id: string | null;
  assigned_to: string | null;
  priority: Activity["priority"];
  status: Activity["status"];
  due_at: string | null;
  start_at: string | null;
  reminder_at: string | null;
}

function primaryEntity(a: Pick<Activity, "lead_id" | "deal_id" | "client_id" | "contact_id" | "project_id">): { type: string; id: string } {
  if (a.lead_id) return { type: "lead", id: a.lead_id };
  if (a.deal_id) return { type: "deal", id: a.deal_id };
  if (a.project_id) return { type: "project", id: a.project_id };
  if (a.client_id) return { type: "client", id: a.client_id };
  return { type: "contact", id: a.contact_id! };
}

const typeVerb: Partial<Record<ActivityType, string>> = {
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp message",
  linkedin: "LinkedIn message",
  meeting: "Meeting",
  follow_up: "Follow-up",
  task: "Task",
  note: "Note",
  internal: "Internal activity",
  client_communication: "Client communication",
};

export async function createActivity(bos: BosUser, input: ActivityInput) {
  if (!input.lead_id && !input.deal_id && !input.client_id && !input.contact_id && !input.project_id) {
    throw new ValidationError("يجب ربط النشاط بسجل (عميل محتمل، صفقة، حساب، جهة اتصال أو مشروع).");
  }
  if (input.due_at && input.start_at && new Date(input.due_at) < new Date(input.start_at)) {
    throw new ValidationError("تاريخ الاستحقاق يجب أن يكون بعد تاريخ البدء.", { due_at: "غير صالح" });
  }

  // Communications that already happened are logged as completed.
  const isLog = communicationTypes.includes(input.type) && !input.due_at && input.status === "pending";
  const status = isLog ? "completed" : input.status;

  // Inherit account/contact from the deal or lead so the account 360° view sees it.
  let clientId = input.client_id;
  if (!clientId && input.deal_id) {
    const { data } = await db().from("deals").select("client_id").eq("id", input.deal_id).maybeSingle();
    clientId = data?.client_id ?? null;
  }
  if (!clientId && input.lead_id) {
    const { data } = await db().from("leads").select("client_id").eq("id", input.lead_id).maybeSingle();
    clientId = data?.client_id ?? null;
  }
  if (!clientId && input.project_id) {
    const { data } = await db().from("projects").select("client_id").eq("id", input.project_id).maybeSingle();
    clientId = data?.client_id ?? null;
  }

  const { data, error } = await db()
    .from("activities")
    .insert({
      ...input,
      client_id: clientId,
      status,
      completed_at: status === "completed" ? nowIso() : null,
      assigned_to: input.assigned_to ?? bos.userId,
      created_by: bos.userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  const entity = primaryEntity(data);
  const verb = typeVerb[data.type] ?? "Activity";
  const dirText = data.direction === "inbound" ? " received" : data.direction === "outbound" ? " sent" : "";
  await emitEvent({
    type: status === "completed" ? "activity.logged" : "activity.scheduled",
    entityType: entity.type,
    entityId: entity.id,
    summary: `${verb}${dirText}: ${data.title}${status !== "completed" && data.due_at ? " (scheduled)" : ""}`,
    payload: { activity_id: data.id, activity_type: data.type, direction: data.direction, assignee_user_id: data.assigned_to, due_at: data.due_at },
    links: [
      { type: "lead", id: data.lead_id },
      { type: "deal", id: data.deal_id },
      { type: "client", id: data.client_id },
      { type: "contact", id: data.contact_id },
      { type: "project", id: data.project_id },
    ].filter((l) => !(l.type === entity.type && l.id === entity.id)),
    actorId: bos.userId,
  });
  if (data.assigned_to && data.assigned_to !== bos.userId && status !== "completed") {
    await emitEvent({
      type: "task.assigned",
      entityType: "activity",
      entityId: data.id,
      summary: `${verb} assigned to you: ${data.title}`,
      payload: { assignee_user_id: data.assigned_to },
      actorId: bos.userId,
    });
  }
  return data;
}

export async function completeActivity(bos: BosUser, id: string, outcome: string | null) {
  const { data: before } = await db().from("activities").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if (before.status === "completed") return before;
  const { data } = await db()
    .from("activities")
    .update({ status: "completed", completed_at: nowIso(), outcome: outcome ?? before.outcome })
    .eq("id", id)
    .select("*")
    .single();
  await recordStatus("activity", id, before.status, "completed", bos.userId);
  const entity = primaryEntity(before);
  await emitEvent({
    type: "activity.completed",
    entityType: entity.type,
    entityId: entity.id,
    summary: `${typeVerb[before.type] ?? "Activity"} completed: ${before.title}${outcome ? ` — ${outcome}` : ""}`,
    payload: { activity_id: id, activity_type: before.type, creator_user_id: before.created_by },
    actorId: bos.userId,
  });
  return data;
}

export async function setActivityStatus(bos: BosUser, id: string, status: Activity["status"]) {
  if (status === "completed") return completeActivity(bos, id, null);
  const { data: before } = await db().from("activities").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  await db().from("activities").update({ status, completed_at: null }).eq("id", id);
  await recordStatus("activity", id, before.status, status, bos.userId);
  await audit({ actorId: bos.userId, action: "activity.status_changed", entityType: "activity", entityId: id, oldValue: { status: before.status }, newValue: { status } });
}

export async function archiveActivity(bos: BosUser, id: string) {
  await db().from("activities").update({ archived_at: nowIso() }).eq("id", id);
  await audit({ actorId: bos.userId, action: "activity.archived", entityType: "activity", entityId: id });
}

export interface ActivityFilters {
  q?: string;
  type?: string;
  status?: string;
  assigned?: string;
  mine?: string;
  related?: string;
  from?: string;
  to?: string;
  page?: number;
}

export async function listActivities(bos: BosUser, scope: Scope, f: ActivityFilters) {
  const pageSize = 30;
  const page = Math.max(1, f.page ?? 1);
  let query = db()
    .from("activities")
    .select("*, leads(name), deals(name), clients(name), contacts(full_name), projects(name)", { count: "exact" })
    .is("archived_at", null);

  if (scope !== "all" || f.mine === "1") {
    const users = f.mine === "1" ? [bos.userId] : scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
    query = query.or(`assigned_to.in.(${users.join(",")}),created_by.in.(${users.join(",")})`);
  }
  if (f.q) query = query.ilike("title", `%${f.q.replace(/[%_]/g, " ")}%`);
  if (f.type) query = query.eq("type", f.type as ActivityType);
  if (f.status) query = query.eq("status", f.status as Activity["status"]);
  if (f.assigned) query = query.eq("assigned_to", f.assigned);
  if (f.related === "lead") query = query.not("lead_id", "is", null);
  if (f.related === "deal") query = query.not("deal_id", "is", null);
  if (f.related === "client") query = query.not("client_id", "is", null);
  if (f.related === "project") query = query.not("project_id", "is", null);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59Z`);

  const { data, count, error } = await query
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listEntityActivities(filter: { lead_id?: string; deal_id?: string; client_id?: string; contact_id?: string; project_id?: string }, onlyCommunications = false) {
  let query = db().from("activities").select("*").is("archived_at", null);
  for (const [k, v] of Object.entries(filter)) if (v) query = query.eq(k, v);
  if (onlyCommunications) query = query.in("type", communicationTypes);
  const { data } = await query.order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}
