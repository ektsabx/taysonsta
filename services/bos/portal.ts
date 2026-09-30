import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import { portalDb, portalOwns, type PortalUser } from "@/lib/bos/portal-auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";

// Client portal data (docs/bos/18). Every read goes through the user-scoped
// client, so RLS (portal_client_id()) enforces isolation, AND filters by the
// session's clientId explicitly. Mutations re-verify ownership before using
// the service client.

async function assertOwns(p: PortalUser, type: string, id: string) {
  if (!(await portalOwns(type, id))) throw new NotFoundError();
}

export async function portalDashboard(p: PortalUser) {
  const s = await portalDb();
  const today = nowIso().slice(0, 10);
  const [projects, milestones, approvals, invoices, tickets] = await Promise.all([
    s.from("projects").select("id, name, project_number, status, progress, deadline").eq("client_id", p.clientId).not("status", "in", "(cancelled)").order("created_at", { ascending: false }),
    s.from("milestones").select("id, name, due_date, status, project_id, projects!inner(client_id, name)").eq("projects.client_id", p.clientId).neq("status", "completed").gte("due_date", today).order("due_date").limit(3),
    s.from("approvals").select("id, title, approval_type, requested_at, approver_contact_id").eq("status", "pending").order("requested_at", { ascending: false }).limit(10),
    s.from("invoices").select("id, invoice_number, balance, currency, due_date, status").eq("client_id", p.clientId).in("status", ["sent", "partially_paid", "overdue"]).order("due_date"),
    s.from("tickets").select("id", { count: "exact", head: true }).eq("client_id", p.clientId).not("status", "in", "(resolved,closed)"),
  ]);
  const channels = await s.from("channels").select("id").eq("client_id", p.clientId).eq("client_visible", true);
  const channelIds = (channels.data ?? []).map((c) => c.id);
  const { data: messages } = channelIds.length ? await s.from("messages").select("id, channel_id, body, created_at, author_user_id, author_contact_id").in("channel_id", channelIds).order("created_at", { ascending: false }).limit(5) : { data: [] };
  return {
    projects: projects.data ?? [],
    upcoming: milestones.data ?? [],
    approvals: (approvals.data ?? []).filter((a) => !a.approver_contact_id || a.approver_contact_id === p.contactId),
    invoices: invoices.data ?? [],
    openTickets: tickets.count ?? 0,
    messages: messages ?? [],
  };
}

export async function portalProjects(p: PortalUser) {
  const s = await portalDb();
  const { data } = await s.from("projects").select("id, name, project_number, status, progress, start_date, deadline, completed_at, satisfaction_score, support_until").eq("client_id", p.clientId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function portalProject(p: PortalUser, id: string) {
  await assertOwns(p, "project", id);
  const s = await portalDb();
  const { data: project } = await s.from("projects").select("id, name, project_number, status, progress, start_date, deadline, completed_at, satisfaction_score, support_until").eq("id", id).eq("client_id", p.clientId).maybeSingle();
  if (!project) throw new NotFoundError();
  const [milestones, crs, meetings] = await Promise.all([
    s.from("milestones").select("id, name, description, due_date, status, progress, deliverables, requires_client_approval, approval_status, completed_at").eq("project_id", id).order("sort_order"),
    s.from("change_requests").select("id, cr_number, title, status, additional_cost, currency, additional_days, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    s.from("meetings").select("id, title, start_at, duration_minutes, status, meeting_link").eq("project_id", id).order("start_at", { ascending: false }),
  ]);
  const milestoneIds = (milestones.data ?? []).map((m) => m.id);
  const [files, approvals, tasks] = await Promise.all([
    portalFiles(p, { projectId: id, milestoneIds }),
    portalApprovals(p, { projectId: id, milestoneIds }),
    // Ownership was verified above; only client-visible tasks and safe columns.
    db().from("tasks").select("id, title, status, due_date, milestone_id, completed_at").eq("project_id", id).eq("client_visible", true).is("archived_at", null).order("due_date", { ascending: true, nullsFirst: false }).limit(300),
  ]);
  return { project, milestones: milestones.data ?? [], changeRequests: crs.data ?? [], meetings: meetings.data ?? [], files, approvals, tasks: tasks.data ?? [] };
}

export async function portalFiles(p: PortalUser, f: { projectId?: string; milestoneIds?: string[] } = {}) {
  const s = await portalDb();
  let q = s.from("files").select("id, name, mime_type, size_bytes, entity_type, entity_id, version, created_at").eq("client_visible", true).eq("is_latest", true).is("deleted_at", null).eq("is_finalized", true).order("created_at", { ascending: false }).limit(500);
  if (f.projectId) q = q.or([`and(entity_type.eq.project,entity_id.eq.${f.projectId})`, ...(f.milestoneIds?.length ? [`and(entity_type.eq.milestone,entity_id.in.(${f.milestoneIds.join(",")}))`] : [])].join(","));
  const { data } = await q; // RLS limits to entities owned by this client
  return data ?? [];
}

export async function portalApprovals(p: PortalUser, f: { projectId?: string; milestoneIds?: string[]; status?: string } = {}) {
  const s = await portalDb();
  let q = s.from("approvals").select("id, approval_type, entity_type, entity_id, title, status, step, total_steps, approver_contact_id, requested_at, decided_at, decision_comment, decided_by_contact_id").eq("client_visible", true).order("requested_at", { ascending: false }).limit(200);
  if (f.status) q = q.eq("status", f.status as "pending");
  if (f.projectId) q = q.or([`and(entity_type.eq.project,entity_id.eq.${f.projectId})`, ...(f.milestoneIds?.length ? [`and(entity_type.eq.milestone,entity_id.in.(${f.milestoneIds.join(",")}))`] : [])].join(","));
  const { data } = await q;
  return (data ?? []).map((a) => ({ ...a, canDecide: a.status === "pending" && (!!p.contactId && a.approver_contact_id === p.contactId) }));
}

export async function portalDecideApproval(p: PortalUser, approvalId: string, decision: "approved" | "rejected", comment: string | null) {
  await assertOwns(p, "approval", approvalId);
  if (!p.contactId) throw new ForbiddenError("حسابك غير مرتبط بجهة اتصال.");
  const { decideApproval } = await import("@/services/bos/approvals");
  await import("@/services/bos/approval-handlers");
  await decideApproval(approvalId, decision, comment, { bos: null, contactId: p.contactId });
}

export async function portalChangeRequests(p: PortalUser) {
  const s = await portalDb();
  const { data } = await s.from("change_requests").select("id, cr_number, title, description, status, additional_cost, currency, additional_days, created_at, project_id, projects(name)").eq("client_id", p.clientId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function portalCreateChangeRequest(p: PortalUser, input: { projectId: string; title: string; description: string; reason: string | null }) {
  await assertOwns(p, "project", input.projectId);
  if (!input.title.trim() || !input.description.trim()) throw new ValidationError("العنوان والوصف مطلوبان.");
  const { createChangeRequest } = await import("@/services/bos/delivery");
  const { data: project } = await db().from("projects").select("currency").eq("id", input.projectId).single();
  const cr = await createChangeRequest({ userId: null, contactId: p.contactId }, input.projectId, { title: input.title.trim(), description: input.description.trim(), reason: input.reason, impact: null, additional_cost: "0", currency: project?.currency ?? "USD", additional_days: 0, requested_by_contact_id: p.contactId });
  await audit({ actorId: null, actorType: "client", action: "change_request.created_by_client", entityType: "change_request", entityId: cr.id, newValue: input, metadata: { contact_id: p.contactId } });
  return cr;
}

export async function portalInvoices(p: PortalUser) {
  const s = await portalDb();
  const { data } = await s.from("invoices").select("id, invoice_number, issue_date, due_date, total, amount_paid, balance, currency, status").eq("client_id", p.clientId).neq("status", "draft").order("issue_date", { ascending: false });
  return data ?? [];
}

export async function portalInvoice(p: PortalUser, id: string) {
  await assertOwns(p, "invoice", id);
  const s = await portalDb();
  const [{ data: invoice }, { data: items }, { data: payments }] = await Promise.all([
    s.from("invoices").select("*").eq("id", id).eq("client_id", p.clientId).neq("status", "draft").maybeSingle(),
    s.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
    s.from("payments").select("id, payment_number, amount, currency, payment_date, method, status").eq("invoice_id", id).eq("client_id", p.clientId),
  ]);
  if (!invoice) throw new NotFoundError();
  return { invoice, items: items ?? [], payments: payments ?? [] };
}

export async function portalPayments(p: PortalUser) {
  const s = await portalDb();
  const { data } = await s.from("payments").select("id, payment_number, amount, refunded_amount, currency, payment_date, method, status, invoice_id, invoices(invoice_number)").eq("client_id", p.clientId).order("payment_date", { ascending: false });
  return data ?? [];
}

export async function portalMeetings(p: PortalUser) {
  const s = await portalDb();
  const { data } = await s.from("meetings").select("id, title, start_at, duration_minutes, status, meeting_link, location, project_id").eq("client_id", p.clientId).order("start_at", { ascending: false });
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export async function portalTickets(p: PortalUser) {
  const s = await portalDb();
  const { data } = await s.from("tickets").select("id, ticket_number, subject, category, priority, status, created_at, updated_at, project_id").eq("client_id", p.clientId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function portalTicket(p: PortalUser, id: string) {
  await assertOwns(p, "ticket", id);
  const s = await portalDb();
  const { data: ticket } = await s.from("tickets").select("id, ticket_number, subject, description, category, priority, status, created_at, project_id, resolved_at").eq("id", id).eq("client_id", p.clientId).maybeSingle();
  if (!ticket) throw new NotFoundError();
  // Public replies only — internal notes never reach the portal (RLS + filter).
  const { data: replies } = await s.from("comments").select("id, body, author_user_id, author_contact_id, created_at").eq("entity_type", "ticket").eq("entity_id", id).eq("is_internal", false).order("created_at");
  const staffIds = [...new Set((replies ?? []).map((r) => r.author_user_id).filter(Boolean))] as string[];
  const { data: staff } = staffIds.length ? await db().from("employees").select("user_id, full_name").in("user_id", staffIds) : { data: [] };
  const names = new Map((staff ?? []).map((e) => [e.user_id, e.full_name.split(" ")[0]]));
  const files = await (await portalDb()).from("files").select("id, name, created_at").eq("entity_type", "ticket").eq("entity_id", id).eq("client_visible", true).is("deleted_at", null);
  return { ticket, replies: (replies ?? []).map((r) => ({ ...r, author: r.author_contact_id ? "أنت / فريقك" : `${names.get(r.author_user_id ?? "") ?? "فريق"} — تايسونستا` })), files: files.data ?? [] };
}

export async function portalCreateTicket(p: PortalUser, input: { subject: string; description: string; category: string; priority: "low" | "medium" | "high" | "urgent"; projectId: string | null }) {
  if (input.projectId) await assertOwns(p, "project", input.projectId);
  const { createTicket } = await import("@/services/bos/support");
  return createTicket({ contactId: p.contactId ?? undefined }, { client_id: p.clientId, contact_id: p.contactId, project_id: input.projectId, category: input.category, priority: input.priority, subject: input.subject, description: input.description, assigned_to: null }, "portal");
}

export async function portalReplyTicket(p: PortalUser, id: string, body: string) {
  await assertOwns(p, "ticket", id);
  if (!p.contactId) throw new ForbiddenError("حسابك غير مرتبط بجهة اتصال.");
  const { replyToTicket } = await import("@/services/bos/support");
  await replyToTicket({ contactId: p.contactId }, id, body, false);
}

export async function portalFeatureRequests(p: PortalUser) {
  const s = await portalDb();
  const { data } = await s.from("feature_requests").select("id, title, status, priority, created_at").eq("client_id", p.clientId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function portalCreateFeatureRequest(p: PortalUser, input: { title: string; description: string; businessValue: string | null; projectId: string | null }) {
  if (input.projectId) await assertOwns(p, "project", input.projectId);
  const { createFeatureRequest } = await import("@/services/bos/support");
  return createFeatureRequest({ contactId: p.contactId ?? undefined }, { client_id: p.clientId, project_id: input.projectId, title: input.title, description: input.description, business_value: input.businessValue, priority: "medium", estimated_effort_hours: null, cost: null, currency: null });
}

// ---------------------------------------------------------------------------
// Messages: one client-visible channel per project (docs/bos/14 edge case:
// only messages in client channels are ever shown in the portal).
// ---------------------------------------------------------------------------

export async function ensureClientChannel(projectId: string) {
  const { data: existing } = await db().from("channels").select("id").eq("project_id", projectId).eq("kind", "project").eq("client_visible", true).maybeSingle();
  if (existing) return existing.id;
  const { data: project } = await db().from("projects").select("name, project_number, client_id, pm_id").eq("id", projectId).single();
  if (!project) throw new NotFoundError();
  const { data, error } = await db().from("channels").insert({ kind: "project", name: `${project.project_number} · ${project.name} (Client)`, project_id: projectId, client_id: project.client_id, client_visible: true, is_private: true }).select("id").single();
  if (error) {
    const { data: again } = await db().from("channels").select("id").eq("project_id", projectId).eq("kind", "project").eq("client_visible", true).single();
    return again!.id;
  }
  const { data: members } = await db().from("project_members").select("user_id").eq("project_id", projectId);
  const { data: account } = await db().from("clients").select("account_manager_id").eq("id", project.client_id).single();
  const ids = new Set([...(members ?? []).map((m) => m.user_id), project.pm_id, account?.account_manager_id].filter(Boolean) as string[]);
  if (ids.size) await db().from("channel_members").upsert([...ids].map((user_id) => ({ channel_id: data.id, user_id })), { onConflict: "channel_id,user_id", ignoreDuplicates: true });
  return data.id;
}

export async function portalMessages(p: PortalUser, projectId: string) {
  await assertOwns(p, "project", projectId);
  const channelId = await ensureClientChannel(projectId);
  const s = await portalDb();
  const { data } = await s.from("messages").select("id, body, author_user_id, author_contact_id, created_at, is_system").eq("channel_id", channelId).order("created_at", { ascending: true }).limit(300);
  const staffIds = [...new Set((data ?? []).map((m) => m.author_user_id).filter(Boolean))] as string[];
  const contactIds = [...new Set((data ?? []).map((m) => m.author_contact_id).filter(Boolean))] as string[];
  const [{ data: staff }, { data: contacts }] = await Promise.all([
    staffIds.length ? db().from("employees").select("user_id, full_name").in("user_id", staffIds) : Promise.resolve({ data: [] as { user_id: string | null; full_name: string }[] }),
    contactIds.length ? db().from("contacts").select("id, full_name").in("id", contactIds).eq("client_id", p.clientId) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const staffName = new Map((staff ?? []).map((e) => [e.user_id, e.full_name]));
  const contactName = new Map((contacts ?? []).map((c) => [c.id, c.full_name]));
  return { channelId, messages: (data ?? []).map((m) => ({ ...m, author: m.author_contact_id ? contactName.get(m.author_contact_id) ?? "أنت" : m.author_user_id ? `${staffName.get(m.author_user_id) ?? "فريق"} — تايسونستا` : "تايسونستا", mine: m.author_contact_id === p.contactId })) };
}

export async function portalPostMessage(p: PortalUser, projectId: string, body: string) {
  await assertOwns(p, "project", projectId);
  const text = body.trim();
  if (!text || text.length > 10000) throw new ValidationError("الرسالة يجب أن تكون بين 1 و10000 حرف.");
  const channelId = await ensureClientChannel(projectId);
  const { data: msg, error } = await db().from("messages").insert({ channel_id: channelId, author_contact_id: p.contactId, body: text }).select("id").single();
  if (error) throw error;
  await emitEvent({ type: "chat.client_message", entityType: "project", entityId: projectId, summary: `${p.contactName} (${p.clientName}): ${text.slice(0, 120)}`, actorType: "client", payload: { project_id: projectId, client_id: p.clientId, message_id: msg.id, link: `/admin/communication/chat/${channelId}` }, links: [{ type: "client", id: p.clientId }] });
  return msg.id;
}

export async function portalSubmitSatisfaction(p: PortalUser, projectId: string, score: number, comment: string | null) {
  await assertOwns(p, "project", projectId);
  if (!Number.isInteger(score) || score < 1 || score > 10) throw new ValidationError("التقييم من 1 إلى 10.");
  const { data: project } = await db().from("projects").select("status, satisfaction_score, name, pm_id").eq("id", projectId).single();
  if (project?.status !== "completed") throw new ValidationError("التقييم متاح بعد اكتمال المشروع.");
  await db().from("projects").update({ satisfaction_score: score }).eq("id", projectId);
  if (comment) await db().from("comments").insert({ entity_type: "project", entity_id: projectId, body: `Client satisfaction ${score}/10: ${comment}`, is_internal: false, author_contact_id: p.contactId });
  await audit({ actorId: null, actorType: "client", action: "project.satisfaction_submitted", entityType: "project", entityId: projectId, oldValue: { score: project.satisfaction_score }, newValue: { score, comment }, metadata: { contact_id: p.contactId } });
  await emitEvent({ type: "project.satisfaction_submitted", entityType: "project", entityId: projectId, summary: `Client rated ${project.name}: ${score}/10`, actorType: "client", payload: { project_id: projectId, pm_id: project.pm_id, score } });
}

export async function markPortalLogin(p: PortalUser) {
  await db().from("client_portal_users").update({ last_login_at: nowIso(), status: "active" }).eq("id", p.portalUserId).neq("status", "disabled");
}
