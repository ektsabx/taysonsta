import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { branchFilter, withBranch } from "@/lib/bos/branch";
import { db, dec, type DbEnum, type Tables } from "@/lib/bos/db";
import { scopeUserIds, type BosUser } from "@/lib/bos/auth";
import { myClientIds, myProjectIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { staffWithRole } from "@/services/bos/shared";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Support (§48–50): SLA tickets with public replies vs internal notes, bugs
// with a QA workflow, feature requests that can become upsell deals.

export type Ticket = Tables<"tickets">;
export type TicketStatus = DbEnum<"ticket_status">;
export type BugStatus = DbEnum<"bug_status">;
export type FeatureStatus = DbEnum<"feature_request_status">;

export const ticketTransitions: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "waiting_for_client", "resolved", "closed"],
  in_progress: ["waiting_for_client", "resolved", "closed"],
  waiting_for_client: ["in_progress", "resolved", "closed"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

export const bugTransitions: Record<BugStatus, BugStatus[]> = {
  reported: ["triaged", "closed"],
  triaged: ["in_progress", "closed"],
  in_progress: ["ready_for_qa"],
  ready_for_qa: ["qa", "in_progress"],
  qa: ["fixed", "in_progress"],
  fixed: ["closed", "in_progress"],
  closed: [],
};

export const featureTransitions: Record<FeatureStatus, FeatureStatus[]> = {
  requested: ["review", "rejected"],
  review: ["approved", "rejected"],
  approved: ["planned", "rejected"],
  rejected: ["review"],
  planned: ["in_development"],
  in_development: ["released"],
  released: [],
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

export async function convertTicketToBug(bos: BosUser, ticketId: string, input: { title: string; severity: string; environment: string; steps_to_reproduce: string | null; assigned_to: string | null }) {
  const t = await getTicket(ticketId);
  if (!t.project_id) throw new ValidationError("اربط التذكرة بمشروع أولاً لإنشاء خطأ برمجي.", { project_id: "مطلوب" });
  const bug = await createBug(bos, {
    project_id: t.project_id,
    ticket_id: ticketId,
    title: input.title || t.subject,
    environment: input.environment as BugInput["environment"],
    severity: input.severity as BugInput["severity"],
    priority: t.priority,
    description: t.description,
    steps_to_reproduce: input.steps_to_reproduce,
    expected_behavior: null,
    actual_behavior: null,
    assigned_to: input.assigned_to,
    reported_by_contact_id: t.contact_id ?? t.created_by_contact_id,
  });
  await replyToTicket({ bos }, ticketId, `Converted to bug ${bug.bug_number}`, true);
  return bug;
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

// ---------------------------------------------------------------------------
// Bugs
// ---------------------------------------------------------------------------

export interface BugInput {
  project_id: string;
  ticket_id: string | null;
  title: string;
  environment: "production" | "staging" | "development";
  severity: "critical" | "major" | "minor" | "trivial";
  priority: Ticket["priority"];
  description: string | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  assigned_to: string | null;
  reported_by_contact_id?: string | null;
}

export async function listBugs(bos: BosUser, scope: Scope, f: { q?: string; status?: string; severity?: string; project?: string; assigned?: string; qa?: string }) {
  let q = db().from("bugs").select("*, projects(id, name)").order("created_at", { ascending: false }).limit(500);
  if (scope !== "all") {
    const users = (await scopeUserIds(bos, scope)) ?? [bos.userId];
    const projects = await myProjectIds(bos);
    q = q.or([`assigned_to.in.(${users.join(",")})`, `reported_by_user_id.in.(${users.join(",")})`, ...(projects.length ? [`project_id.in.(${projects.join(",")})`] : [])].join(","));
  }
  if (f.status) q = q.eq("status", f.status as BugStatus);
  if (f.severity) q = q.eq("severity", f.severity);
  if (f.project) q = q.eq("project_id", f.project);
  if (f.assigned === "me") q = q.eq("assigned_to", bos.userId);
  else if (f.assigned) q = q.eq("assigned_to", f.assigned);
  if (f.qa) q = q.eq("qa_status", f.qa);
  if (f.q) q = q.or(`title.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,bug_number.ilike.%${f.q.replace(/[%_,()]/g, " ")}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getBug(id: string) {
  const { data } = await db().from("bugs").select("*, projects(id, name, pm_id), tickets(id, ticket_number, subject), contacts(full_name)").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

export async function createBug(bos: BosUser, input: BugInput) {
  if (input.environment === "production" && !input.steps_to_reproduce?.trim()) throw new ValidationError("خطوات إعادة الإنتاج مطلوبة لأخطاء بيئة الإنتاج.", { steps_to_reproduce: "مطلوب" });
  const { data, error } = await db().from("bugs").insert({ ...input, reported_by_user_id: bos.userId }).select("*").single();
  if (error) throw error;
  await recordStatus("bug", data.id, null, "reported", bos.userId);
  await audit({ actorId: bos.userId, action: "bug.created", entityType: "bug", entityId: data.id, newValue: input });
  await emitEvent({ type: "bug.created", entityType: "bug", entityId: data.id, summary: `Bug ${data.bug_number}: ${data.title} (${data.severity})`, actorId: bos.userId, payload: { project_id: data.project_id, severity: data.severity, assignee_user_id: data.assigned_to }, links: [{ type: "project", id: data.project_id }, { type: "ticket", id: data.ticket_id }] });
  if (data.assigned_to) await emitEvent({ type: "bug.assigned", entityType: "bug", entityId: data.id, summary: `Bug assigned: ${data.bug_number} ${data.title}`, actorId: bos.userId, payload: { assignee_user_id: data.assigned_to, project_id: data.project_id } });
  return data;
}

export async function updateBug(bos: BosUser, id: string, input: Omit<BugInput, "project_id" | "ticket_id">) {
  const before = await getBug(id);
  if (input.environment === "production" && !input.steps_to_reproduce?.trim()) throw new ValidationError("خطوات إعادة الإنتاج مطلوبة لأخطاء بيئة الإنتاج.", { steps_to_reproduce: "مطلوب" });
  await db().from("bugs").update(input).eq("id", id);
  await audit({ actorId: bos.userId, action: "bug.updated", entityType: "bug", entityId: id, oldValue: { severity: before.severity, assigned_to: before.assigned_to, priority: before.priority }, newValue: { severity: input.severity, assigned_to: input.assigned_to, priority: input.priority } });
  if (input.assigned_to && input.assigned_to !== before.assigned_to) await emitEvent({ type: "bug.assigned", entityType: "bug", entityId: id, summary: `Bug assigned: ${before.bug_number} ${input.title}`, actorId: bos.userId, payload: { assignee_user_id: input.assigned_to, project_id: before.project_id } });
}

export async function advanceBug(bos: BosUser, id: string, to: BugStatus, reason: string | null = null) {
  const b = await getBug(id);
  if (b.status === to) return;
  if (!bugTransitions[b.status].includes(to)) throw new ValidationError(`لا يمكن الانتقال من «${b.status}» إلى «${to}».`);
  const patch: Partial<Tables<"bugs">> = { status: to };
  if (to === "ready_for_qa") patch.qa_status = "not_tested";
  await db().from("bugs").update(patch).eq("id", id);
  await recordStatus("bug", id, b.status, to, bos.userId, reason);
  await audit({ actorId: bos.userId, action: "bug.status_changed", entityType: "bug", entityId: id, oldValue: { status: b.status }, newValue: { status: to }, reason });
  await emitEvent({ type: to === "ready_for_qa" ? "bug.ready_for_qa" : "bug.status_changed", entityType: "bug", entityId: id, summary: `${b.bug_number}: ${b.status} → ${to}`, actorId: bos.userId, payload: { from: b.status, to, project_id: b.project_id, assignee_user_id: b.assigned_to } });
}

// QA passed → Fixed; QA failed → back to In Progress (workflow §49).
export async function setQaStatus(bos: BosUser, id: string, qa: "passed" | "failed", note: string | null) {
  const b = await getBug(id);
  if (!["qa", "ready_for_qa"].includes(b.status)) throw new ValidationError("الخطأ ليس في مرحلة الاختبار.");
  await db().from("bugs").update({ qa_status: qa }).eq("id", id);
  await audit({ actorId: bos.userId, action: `bug.qa_${qa}`, entityType: "bug", entityId: id, reason: note });
  if (b.status === "ready_for_qa") await advanceBug(bos, id, "qa");
  await advanceBug(bos, id, qa === "passed" ? "fixed" : "in_progress", note);
}

// ---------------------------------------------------------------------------
// Feature requests
// ---------------------------------------------------------------------------

export interface FeatureInput {
  client_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  business_value: string | null;
  priority: Ticket["priority"];
  estimated_effort_hours: string | null;
  cost: string | null;
  currency: string | null;
}

export async function listFeatureRequests(bos: BosUser, scope: Scope, f: { q?: string; status?: string; client?: string; priority?: string }) {
  let q = db().from("feature_requests").select("*, clients(id, name, company_name), projects(id, name)").order("created_at", { ascending: false }).limit(500);
  if (scope !== "all") {
    const users = (await scopeUserIds(bos, scope)) ?? [bos.userId];
    const [projects, clients] = await Promise.all([myProjectIds(bos), myClientIds(bos, scope)]);
    q = q.or([`requested_by_user_id.in.(${users.join(",")})`, ...(projects.length ? [`project_id.in.(${projects.join(",")})`] : []), ...(clients?.length ? [`client_id.in.(${clients.join(",")})`] : [])].join(","));
  }
  if (f.status) q = q.eq("status", f.status as FeatureStatus);
  if (f.client) q = q.eq("client_id", f.client);
  if (f.priority) q = q.eq("priority", f.priority as Ticket["priority"]);
  if (f.q) q = q.ilike("title", `%${f.q.replace(/[%_]/g, " ")}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getFeatureRequest(id: string) {
  const { data } = await db().from("feature_requests").select("*, clients(id, name, company_name, account_manager_id), projects(id, name, deal_id), contacts(full_name), deals(id, deal_number, name)").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

function validateFeature(input: FeatureInput) {
  if (!input.title.trim()) throw new ValidationError("العنوان مطلوب.", { title: "مطلوب" });
  if (input.cost && !input.currency) throw new ValidationError("حدد العملة للتكلفة.", { currency: "مطلوب" });
}

export async function createFeatureRequest(actor: { bos?: BosUser; contactId?: string }, input: FeatureInput) {
  validateFeature(input);
  if (input.project_id && input.client_id) {
    const { data } = await db().from("projects").select("client_id").eq("id", input.project_id).maybeSingle();
    if (!data || data.client_id !== input.client_id) throw new ValidationError("المشروع لا يتبع هذا الحساب.");
  }
  const { data, error } = await db()
    .from("feature_requests")
    .insert({ ...input, cost: dec(input.cost), estimated_effort_hours: dec(input.estimated_effort_hours), requested_by_user_id: actor.bos?.userId ?? null, requested_by_contact_id: actor.contactId ?? null })
    .select("*")
    .single();
  if (error) throw error;
  await recordStatus("feature_request", data.id, null, "requested", actor.bos?.userId ?? null);
  await audit({ actorId: actor.bos?.userId ?? null, actorType: actor.contactId ? "client" : "user", action: "feature_request.created", entityType: "feature_request", entityId: data.id, newValue: input });
  await emitEvent({ type: "feature_request.created", entityType: "feature_request", entityId: data.id, summary: `Feature request: ${data.title}`, actorId: actor.bos?.userId ?? null, actorType: actor.contactId ? "client" : "user", payload: { client_id: data.client_id, project_id: data.project_id }, links: [{ type: "client", id: data.client_id }] });
  return data;
}

export async function updateFeatureRequest(bos: BosUser, id: string, input: FeatureInput) {
  validateFeature(input);
  const before = await getFeatureRequest(id);
  await db().from("feature_requests").update({ ...input, cost: dec(input.cost), estimated_effort_hours: dec(input.estimated_effort_hours) }).eq("id", id);
  await audit({ actorId: bos.userId, action: "feature_request.updated", entityType: "feature_request", entityId: id, oldValue: { cost: before.cost, priority: before.priority }, newValue: { cost: input.cost, priority: input.priority } });
}

export async function changeFeatureStatus(bos: BosUser, id: string, to: FeatureStatus, reason: string | null) {
  const fr = await getFeatureRequest(id);
  if (fr.status === to) return;
  if (!featureTransitions[fr.status].includes(to)) throw new ValidationError(`لا يمكن الانتقال من «${fr.status}» إلى «${to}».`);
  if (to === "rejected" && !reason) throw new ValidationError("سبب الرفض مطلوب.");
  await db().from("feature_requests").update({ status: to }).eq("id", id);
  await recordStatus("feature_request", id, fr.status, to, bos.userId, reason);
  await audit({ actorId: bos.userId, action: "feature_request.status_changed", entityType: "feature_request", entityId: id, oldValue: { status: fr.status }, newValue: { status: to }, reason });
  const client = fr.clients as unknown as { account_manager_id: string | null } | null;
  await emitEvent({ type: "feature_request.status_changed", entityType: "feature_request", entityId: id, summary: `Feature request "${fr.title}": ${fr.status} → ${to}`, actorId: bos.userId, visibility: "client", payload: { from: to === fr.status ? null : fr.status, to, client_id: fr.client_id, assignee_user_id: to === "approved" && fr.cost ? client?.account_manager_id ?? null : null } });
}

// Feature request → upsell deal linked to client/project/previous deal (§85).
export async function createUpsellDealFromFeatureRequest(bos: BosUser, id: string) {
  const fr = await getFeatureRequest(id);
  if (!fr.client_id) throw new ValidationError("اربط طلب الميزة بحساب أولاً.");
  if (fr.deal_id) throw new ValidationError("تم إنشاء صفقة لهذا الطلب بالفعل.");
  if (!["approved", "planned"].includes(fr.status)) throw new ValidationError("يمكن إنشاء صفقة لطلب معتمد أو مخطط فقط.");
  const project = fr.projects as unknown as { id: string; name: string; deal_id: string | null } | null;
  const client = fr.clients as unknown as { account_manager_id: string | null; company_name: string | null; name: string };
  const { createDeal } = await import("@/services/bos/deals");
  const deal = await createDeal(bos, {
    name: `Upsell: ${fr.title}`,
    client_id: fr.client_id,
    contact_id: fr.requested_by_contact_id,
    lead_id: null,
    source_id: null,
    value: fr.cost ? String(fr.cost) : "0",
    currency: fr.currency ?? "USD",
    probability: null,
    expected_close_date: null,
    assigned_to: client.account_manager_id ?? bos.userId,
    scope: [fr.description, fr.business_value ? `Business value: ${fr.business_value}` : null].filter(Boolean).join("\n\n") || null,
    notes: `Created from feature request ${fr.id}`,
    payment_terms: [{ label: "Full payment", percent: 100 }] as never,
    products: [],
    is_upsell: true,
    previous_project_id: project?.id ?? null,
    previous_deal_id: project?.deal_id ?? null,
  });
  await db().from("feature_requests").update({ deal_id: deal.id }).eq("id", id);
  await audit({ actorId: bos.userId, action: "feature_request.upsell_created", entityType: "feature_request", entityId: id, newValue: { deal_id: deal.id } });
  return deal;
}
