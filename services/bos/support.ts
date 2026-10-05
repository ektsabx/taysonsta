import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { branchFilter, withBranch } from "@/lib/bos/branch";
import { db, type DbEnum, type Tables } from "@/lib/bos/db";
import { scopeUserIds, type BosUser } from "@/lib/bos/auth";
import { myClientIds, myProjectIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { staffWithRole } from "@/services/bos/shared";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Support (§48): SLA tickets with public replies vs internal notes.
// Bugs and feature requests were removed (docs/bos/39 §1).

export type Ticket = Tables<"tickets">;
export type TicketStatus = DbEnum<"ticket_status">;

export const ticketTransitions: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "waiting_for_client", "resolved", "closed"],
  in_progress: ["waiting_for_client", "resolved", "closed"],
  waiting_for_client: ["in_progress", "resolved", "closed"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function listTickets(bos: BosUser, scope: Scope, f: { q?: string; status?: string; priority?: string; assigned?: string; client?: string; project?: string; category?: string; sla?: string; page?: number }) {
  const page = Math.max(1, f.page ?? 1);
  let q = db().from("tickets").select("*, clients(id, name, company_name), contacts!tickets_contact_id_fkey(full_name), projects(id, name)", { count: "exact" });
  q = withBranch(q, await branchFilter(bos));
  if (scope !== "all") {
    const users = (await scopeUserIds(bos, scope)) ?? [bos.userId];
    const [projects, clients] = await Promise.all([myProjectIds(bos), myClientIds(bos, scope)]);
    q = q.or([`assigned_to.in.(${users.join(",")})`, `created_by_user_id.in.(${users.join(",")})`, ...(projects.length ? [`project_id.in.(${projects.join(",")})`] : []), ...(clients?.length ? [`client_id.in.(${clients.join(",")})`] : [])].join(","));
  }
  if (f.status === "open_all") q = q.not("status", "in", "(resolved,closed)");
  else if (f.status) q = q.eq("status", f.status as TicketStatus);
  if (f.priority) q = q.eq("priority", f.priority as Ticket["priority"]);
  if (f.assigned === "me") q = q.eq("assigned_to", bos.userId);
  else if (f.assigned === "none") q = q.is("assigned_to", null);
  else if (f.assigned) q = q.eq("assigned_to", f.assigned);
  if (f.client) q = q.eq("client_id", f.client);
  if (f.project) q = q.eq("project_id", f.project);
  if (f.category) q = q.eq("category", f.category);
  if (f.sla === "breached") q = q.not("sla_breached_at", "is", null);
  if (f.sla === "at_risk") q = q.is("sla_breached_at", null).not("status", "in", "(resolved,closed)").lt("resolution_due_at", new Date(nowMs() + 4 * 3600_000).toISOString());
  if (f.q) q = q.or(`subject.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,ticket_number.ilike.%${f.q.replace(/[%_,()]/g, " ")}%`);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize: 25 };
}

export async function getTicket(id: string) {
  const { data } = await db().from("tickets").select("*, clients(id, name, company_name, account_manager_id), contacts!tickets_contact_id_fkey(id, full_name, email), projects(id, name, pm_id, support_until)").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

export interface TicketInput {
  // null for inbox customers who aren't account contacts yet (docs/bos/30 §10.4).
  client_id: string | null;
  conversation_id?: string | null;
  support_customer_id?: string | null;
  team_id?: string | null;
  contact_id: string | null;
  project_id: string | null;
  category: string;
  priority: Ticket["priority"];
  subject: string;
  description: string;
  assigned_to: string | null;
}

async function validateTicket(input: TicketInput) {
  if (!input.subject.trim() || !input.description.trim()) throw new ValidationError("الموضوع والوصف مطلوبان.");
  if (input.contact_id) {
    const { data } = await db().from("contacts").select("client_id").eq("id", input.contact_id).maybeSingle();
    if (!data || data.client_id !== input.client_id) throw new ValidationError("جهة الاتصال لا تتبع هذا الحساب.", { contact_id: "حساب مختلف" });
  }
  if (input.project_id) {
    const { data } = await db().from("projects").select("client_id").eq("id", input.project_id).maybeSingle();
    if (!data || data.client_id !== input.client_id) throw new ValidationError("المشروع لا يتبع هذا الحساب.", { project_id: "حساب مختلف" });
  }
}

// Auto-assignment: project PM during the support period, else round-robin
// over active support agents (§48 automation).
async function autoAssignee(input: TicketInput): Promise<string | null> {
  if (input.project_id) {
    const { data: p } = await db().from("projects").select("pm_id, support_until, status").eq("id", input.project_id).maybeSingle();
    const today = nowIso().slice(0, 10);
    if (p?.pm_id && p.status === "completed" && p.support_until && p.support_until >= today) return p.pm_id;
  }
  const agents = await staffWithRole("support");
  if (!agents.length) return null;
  const { data: open } = await db().from("tickets").select("assigned_to").in("assigned_to", agents.map((a) => a.userId)).not("status", "in", "(resolved,closed)");
  const load = new Map(agents.map((a) => [a.userId, 0]));
  for (const t of open ?? []) if (t.assigned_to) load.set(t.assigned_to, (load.get(t.assigned_to) ?? 0) + 1);
  return [...load.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

export async function createTicket(actor: { bos?: BosUser; contactId?: string }, input: TicketInput, source: "portal" | "internal" | "email" = "internal") {
  await validateTicket(input);
  const assignee = input.assigned_to ?? (await autoAssignee(input));
  const { data, error } = await db()
    .from("tickets")
    .insert({ ...input, assigned_to: assignee, source, created_by_user_id: actor.bos?.userId ?? null, created_by_contact_id: actor.contactId ?? null })
    .select("*")
    .single();
  if (error) throw error;
  const actorId = actor.bos?.userId ?? null;
  await recordStatus("ticket", data.id, null, "open", actorId);
  await audit({ actorId, actorType: actor.contactId ? "client" : "user", action: "ticket.created", entityType: "ticket", entityId: data.id, newValue: { ...input, assigned_to: assignee, source } });
  await emitEvent({ type: "ticket.created", entityType: "ticket", entityId: data.id, summary: `Ticket ${data.ticket_number}: ${data.subject}`, actorId, actorType: actor.contactId ? "client" : "user", payload: { client_id: data.client_id, project_id: data.project_id, priority: data.priority, assignee_user_id: assignee }, links: [{ type: "client", id: data.client_id }, { type: "project", id: data.project_id }] });
  if (assignee) await emitEvent({ type: "ticket.assigned", entityType: "ticket", entityId: data.id, summary: `Ticket assigned: ${data.ticket_number} ${data.subject}`, actorId, payload: { assignee_user_id: assignee, client_id: data.client_id } });
  return data;
}

export async function updateTicket(bos: BosUser, id: string, patch: Partial<Pick<TicketInput, "category" | "priority" | "project_id" | "subject" | "description">>) {
  const before = await getTicket(id);
  if (patch.project_id) {
    const { data } = await db().from("projects").select("client_id").eq("id", patch.project_id).maybeSingle();
    if (!data || data.client_id !== before.client_id) throw new ValidationError("المشروع لا يتبع هذا الحساب.");
  }
  await db().from("tickets").update(patch).eq("id", id);
  await audit({ actorId: bos.userId, action: "ticket.updated", entityType: "ticket", entityId: id, oldValue: { category: before.category, priority: before.priority, project_id: before.project_id }, newValue: patch });
}

export async function assignTicket(bos: BosUser, id: string, userId: string | null) {
  const t = await getTicket(id);
  await db().from("tickets").update({ assigned_to: userId }).eq("id", id);
  await audit({ actorId: bos.userId, action: "ticket.assigned", entityType: "ticket", entityId: id, oldValue: { assigned_to: t.assigned_to }, newValue: { assigned_to: userId } });
  if (userId) await emitEvent({ type: "ticket.assigned", entityType: "ticket", entityId: id, summary: `Ticket assigned: ${t.ticket_number} ${t.subject}`, actorId: bos.userId, payload: { assignee_user_id: userId, client_id: t.client_id } });
}

export async function changeTicketStatus(actor: { bos?: BosUser; contactId?: string }, id: string, to: TicketStatus, reason: string | null = null) {
  const t = await getTicket(id);
  if (t.status === to) return;
  if (!ticketTransitions[t.status].includes(to)) throw new ValidationError(`لا يمكن الانتقال من «${t.status}» إلى «${to}».`);
  const now = nowIso();
  const patch: Partial<Ticket> = { status: to };
  if (to === "resolved") patch.resolved_at = now;
  if (to === "closed") patch.closed_at = now;
  if (to === "in_progress" && t.status === "resolved") patch.resolved_at = null;
  await db().from("tickets").update(patch).eq("id", id);
  const actorId = actor.bos?.userId ?? null;
  await recordStatus("ticket", id, t.status, to, actorId, reason);
  await audit({ actorId, actorType: actor.contactId ? "client" : "user", action: "ticket.status_changed", entityType: "ticket", entityId: id, oldValue: { status: t.status }, newValue: { status: to }, reason });
  await emitEvent({ type: "ticket.status_changed", entityType: "ticket", entityId: id, summary: `${t.ticket_number}: ${t.status} → ${to}`, actorId, actorType: actor.contactId ? "client" : "user", visibility: "client", payload: { from: t.status, to, client_id: t.client_id, assignee_user_id: t.assigned_to } });
}

// Public replies are visible in the portal; internal notes never are. The
// first public staff reply stamps first_responded_at (SLA).
export async function replyToTicket(actor: { bos?: BosUser; contactId?: string }, id: string, body: string, isInternal: boolean) {
  const t = await getTicket(id);
  const text = body.trim();
  if (!text || text.length > 20000) throw new ValidationError("الرد يجب أن يكون بين 1 و20000 حرف.", { body: "طول غير صالح" });
  if (actor.contactId && isInternal) throw new ValidationError("غير مسموح.");
  if (t.status === "closed") {
    if (actor.contactId) throw new ValidationError("هذه التذكرة مغلقة. افتح تذكرة جديدة.");
    throw new ValidationError("التذكرة مغلقة.");
  }
  const { data: c, error } = await db().from("comments").insert({ entity_type: "ticket", entity_id: id, body: text, is_internal: isInternal, author_user_id: actor.bos?.userId ?? null, author_contact_id: actor.contactId ?? null }).select("id").single();
  if (error) throw error;
  if (actor.bos && !isInternal && !t.first_responded_at) await db().from("tickets").update({ first_responded_at: nowIso() }).eq("id", id);
  // Client reply on resolved / waiting reopens to In Progress.
  if (actor.contactId && ["resolved", "waiting_for_client"].includes(t.status)) await changeTicketStatus(actor, id, "in_progress", "Client replied");
  await emitEvent({
    type: actor.contactId ? "ticket.client_replied" : isInternal ? "ticket.note_added" : "ticket.replied",
    entityType: "ticket",
    entityId: id,
    summary: `${t.ticket_number}: ${actor.contactId ? "client reply" : isInternal ? "internal note" : "reply"}`,
    actorId: actor.bos?.userId ?? null,
    actorType: actor.contactId ? "client" : "user",
    visibility: isInternal ? "internal" : "client",
    payload: { comment_id: c.id, assignee_user_id: t.assigned_to, client_id: t.client_id, contact_id: t.contact_id },
  });
  return c.id;
}

export async function listTicketConversation(id: string, includeInternal: boolean) {
  let q = db().from("comments").select("id, body, is_internal, author_user_id, author_contact_id, created_at, edited_at").eq("entity_type", "ticket").eq("entity_id", id).is("deleted_at", null).order("created_at");
  if (!includeInternal) q = q.eq("is_internal", false);
  const { data } = await q;
  return data ?? [];
}

// Merge: the duplicate's conversation moves to the target and it closes.
export async function mergeTickets(bos: BosUser, sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new ValidationError("لا يمكن دمج التذكرة مع نفسها.");
  const [s, t] = await Promise.all([getTicket(sourceId), getTicket(targetId)]);
  if (s.client_id !== t.client_id) throw new ValidationError("يمكن دمج تذاكر نفس الحساب فقط.");
  await db().from("comments").update({ entity_id: targetId }).eq("entity_type", "ticket").eq("entity_id", sourceId);
  await db().from("files").update({ entity_id: targetId }).eq("entity_type", "ticket").eq("entity_id", sourceId);
  await db().from("comments").insert({ entity_type: "ticket", entity_id: targetId, body: `Merged ${s.ticket_number}: ${s.subject}\n\n${s.description}`, is_internal: true, author_user_id: bos.userId });
  if (s.status !== "closed") {
    await db().from("tickets").update({ status: "closed", closed_at: nowIso() }).eq("id", sourceId);
    await recordStatus("ticket", sourceId, s.status, "closed", bos.userId, `Merged into ${t.ticket_number}`);
  }
  await audit({ actorId: bos.userId, action: "ticket.merged", entityType: "ticket", entityId: targetId, newValue: { source: s.ticket_number } });
}

// Auto-close resolved tickets after N days without a client reply.
export async function autoCloseResolved(days = 7) {
  const cutoff = new Date(nowMs() - days * 86400_000).toISOString();
  const { data } = await db().from("tickets").select("id, status").eq("status", "resolved").lt("resolved_at", cutoff);
  for (const t of data ?? []) {
    await db().from("tickets").update({ status: "closed", closed_at: nowIso() }).eq("id", t.id);
    await recordStatus("ticket", t.id, "resolved", "closed", null, `Auto-closed after ${days} days`);
  }
  return (data ?? []).length;
}
