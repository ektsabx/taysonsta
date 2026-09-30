import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { branchFilter, withBranch } from "@/lib/bos/branch";
import { db, dec, type Tables, type Updates } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { myProjectIds, teamProjectIds, myClientIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { getSetting } from "@/lib/bos/settings";
import { ensureProjectChannel, syncProjectChannelMembers, postSystemMessage } from "@/lib/bos/chat-core";
import { requestApproval } from "@/services/bos/approvals";

export type Project = Tables<"projects">;
export type ProjectStatus = Project["status"];

// Project lifecycle (§21, §84). Forward flow + allowed backward moves
// (e.g. QA → Development); on_hold ↔ previous; cancel from any active state.
const flow: ProjectStatus[] = ["planning", "design", "development", "qa", "client_review", "launch", "completed"];

export function allowedTransitions(from: ProjectStatus): ProjectStatus[] {
  if (from === "completed") return ["launch"];
  if (from === "cancelled") return [];
  const active = flow.filter((s) => s !== "completed");
  if (from === "on_hold") return [...active, "cancelled"];
  return [...active.filter((s) => s !== from), "completed", "on_hold", "cancelled"];
}

export const blockerLabels: Record<string, string> = {
  required_tasks_incomplete: "توجد مهام مطلوبة غير مكتملة",
  final_approval_missing: "لم يوافق العميل على التسليم النهائي بعد",
  pending_approvals: "توجد موافقات معلقة على المشروع",
  final_payment_pending: "لم يتم استلام الدفعة النهائية (فواتير غير مسددة)",
};

async function projectIdsForScope(bos: BosUser, scope: Scope): Promise<string[] | null> {
  if (scope === "all") return null;
  const ids = scope === "team" ? await teamProjectIds(bos) : await myProjectIds(bos);
  if (bos.roleKeys.includes("account_manager") || bos.roleKeys.includes("finance")) {
    const clients = await myClientIds(bos, scope);
    if (clients?.length) {
      const { data } = await db().from("projects").select("id").in("client_id", clients);
      return [...new Set([...ids, ...(data ?? []).map((p) => p.id)])];
    }
  }
  return ids;
}

export interface ProjectFilters {
  q?: string;
  status?: string;
  health?: string;
  pm?: string;
  client?: string;
  mine?: string;
  page?: number;
}

export async function listProjects(bos: BosUser, scope: Scope, f: ProjectFilters) {
  const pageSize = 25;
  const page = Math.max(1, f.page ?? 1);
  let q = db()
    .from("projects")
    .select("id, project_number, name, status, health, progress, budget, currency, start_date, deadline, pm_id, client_id, deal_id, clients(name, company_name), deals!projects_deal_id_fkey(payment_status)", { count: "exact" })
    .is("archived_at", null);
  q = withBranch(q, await branchFilter(bos));
  const ids = f.mine === "1" ? await myProjectIds(bos) : await projectIdsForScope(bos, scope);
  if (ids) q = ids.length ? q.in("id", ids) : q.eq("id", "00000000-0000-0000-0000-000000000000");
  if (f.status === "active") q = q.not("status", "in", "(completed,cancelled,on_hold)");
  else if (f.status) q = q.eq("status", f.status as ProjectStatus);
  if (f.health) q = q.eq("health", f.health as Project["health"]);
  if (f.pm) q = q.eq("pm_id", f.pm);
  if (f.client) q = q.eq("client_id", f.client);
  if (f.q) q = q.or(`name.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,project_number.ilike.%${f.q.replace(/[%_,()]/g, " ")}%`);
  const { data, count, error } = await q.order("deadline", { ascending: true, nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getProject(id: string) {
  const { data, error } = await db()
    .from("projects")
    .select("*, clients(id, name, company_name, account_manager_id), contacts(id, full_name, email, phone), deals!projects_deal_id_fkey(id, name, deal_number, value, currency, payment_status, assigned_to), contracts!projects_contract_id_fkey(id, contract_number, status)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError();
  return data;
}

function links(p: Pick<Project, "client_id" | "deal_id">) {
  return [
    { type: "client", id: p.client_id },
    { type: "deal", id: p.deal_id },
  ];
}

export interface ProjectInput {
  name: string;
  client_id: string;
  primary_contact_id: string | null;
  pm_id: string | null;
  budget: string;
  currency: string;
  scope: string | null;
  start_date: string | null;
  deadline: string | null;
}

// Internal/manual projects (no deal). Deal projects come from Deal Won.
export async function createProject(bos: BosUser, input: ProjectInput) {
  if (input.deadline && input.start_date && input.deadline < input.start_date) throw new ValidationError("الموعد النهائي قبل تاريخ البداية.", { deadline: "غير صالح" });
  const { data, error } = await db()
    .from("projects")
    .insert({ ...input, budget: dec(input.budget || "0"), status: "planning", created_by: bos.userId })
    .select("*")
    .single();
  if (error) throw error;
  if (data.pm_id) await db().from("project_members").insert({ project_id: data.id, user_id: data.pm_id, role_label: "Project Manager" });
  await recordStatus("project", data.id, null, "planning", bos.userId);
  await audit({ actorId: bos.userId, action: "project.created", entityType: "project", entityId: data.id, newValue: { name: data.name, budget: data.budget, currency: data.currency, pm_id: data.pm_id } });
  await emitEvent({ type: "project.created", entityType: "project", entityId: data.id, summary: `Project created: ${data.name}`, payload: { project_id: data.id, pm_id: data.pm_id, client_id: data.client_id }, links: links(data), actorId: bos.userId });
  return data;
}

export async function updateProject(bos: BosUser, id: string, input: Partial<ProjectInput>) {
  const { data: before } = await db().from("projects").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  const patch: Updates<"projects"> = { ...input, budget: undefined } as Updates<"projects">;
  if (input.budget !== undefined) patch.budget = dec(input.budget);
  else delete patch.budget;
  if (input.deadline && (input.start_date ?? before.start_date) && input.deadline < (input.start_date ?? before.start_date)!) throw new ValidationError("الموعد النهائي قبل تاريخ البداية.", { deadline: "غير صالح" });
  const { error } = await db().from("projects").update(patch).eq("id", id);
  if (error) throw error;
  const changed = Object.keys(input).filter((k) => String((before as Record<string, unknown>)[k] ?? "") !== String((input as Record<string, unknown>)[k] ?? ""));
  if (changed.length) {
    await audit({
      actorId: bos.userId,
      action: "project.updated",
      entityType: "project",
      entityId: id,
      oldValue: Object.fromEntries(changed.map((k) => [k, (before as Record<string, unknown>)[k]])),
      newValue: Object.fromEntries(changed.map((k) => [k, (input as Record<string, unknown>)[k]])),
    });
  }
  if (input.pm_id !== undefined && input.pm_id !== before.pm_id && input.pm_id) {
    await assignPm(bos, id, input.pm_id, true);
  }
  await db().rpc("bos_recompute_project_health", { p_project: id });
}

export async function assignPm(bos: BosUser, id: string, pmId: string, skipUpdate = false) {
  const { data: p } = await db().from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) throw new NotFoundError();
  if (!skipUpdate) await db().from("projects").update({ pm_id: pmId }).eq("id", id);
  await db().from("project_members").upsert({ project_id: id, user_id: pmId, role_label: "Project Manager" }, { onConflict: "project_id,user_id" });
  await db().from("milestones").update({ owner_id: pmId }).eq("project_id", id).is("owner_id", null);
  const channel = await ensureProjectChannel(id, bos.userId);
  if (channel) await syncProjectChannelMembers(id, channel);
  await audit({ actorId: bos.userId, action: "project.pm_assigned", entityType: "project", entityId: id, oldValue: { pm_id: p.pm_id }, newValue: { pm_id: pmId } });
  await emitEvent({ type: "project.pm_assigned", entityType: "project", entityId: id, summary: "PM assigned", payload: { project_id: id, pm_id: pmId }, links: links(p), actorId: bos.userId, dedupeKey: `project.pm_assigned:${id}:${pmId}:${nowMs()}` });
}

export async function setMember(bos: BosUser, id: string, userId: string, roleLabel: string | null, allocation: number | null, remove = false) {
  if (remove) {
    const { data: p } = await db().from("projects").select("pm_id").eq("id", id).maybeSingle();
    if (p?.pm_id === userId) throw new ValidationError("لا يمكن إزالة مدير المشروع. عيّن مديراً آخر أولاً.");
    const { count } = await db().from("tasks").select("id", { count: "exact", head: true }).eq("project_id", id).eq("assigned_to", userId).in("status", ["pending", "in_progress", "blocked", "overdue"]);
    await db().from("project_members").delete().eq("project_id", id).eq("user_id", userId);
    await db().from("channel_members").delete().eq("user_id", userId).in("channel_id", (await db().from("channels").select("id").eq("project_id", id)).data?.map((c) => c.id) ?? []);
    await audit({ actorId: bos.userId, action: "project.member_removed", entityType: "project", entityId: id, oldValue: { user_id: userId }, metadata: { open_tasks: count ?? 0 } });
    if ((count ?? 0) > 0) {
      await emitEvent({ type: "project.member_removed_with_tasks", entityType: "project", entityId: id, summary: `Member removed with ${count} open task(s) — reassignment needed`, payload: { project_id: id }, actorId: bos.userId });
    }
    return;
  }
  await db().from("project_members").upsert({ project_id: id, user_id: userId, role_label: roleLabel, allocation_percent: allocation }, { onConflict: "project_id,user_id" });
  const channel = await ensureProjectChannel(id, bos.userId);
  if (channel) await syncProjectChannelMembers(id, channel);
  await audit({ actorId: bos.userId, action: "project.member_added", entityType: "project", entityId: id, newValue: { user_id: userId, role: roleLabel, allocation } });
  await emitEvent({ type: "project.member_added", entityType: "project", entityId: id, summary: "Team member added", payload: { assignee_user_id: userId, project_id: id }, actorId: bos.userId });
}

export async function completionBlockers(id: string): Promise<string[]> {
  const { data } = await db().rpc("bos_project_completion_blockers", { p_project: id });
  return (data as string[] | null) ?? [];
}

export async function changeProjectStatus(bos: BosUser, id: string, to: ProjectStatus, opts: { reason?: string | null; force?: boolean } = {}) {
  const { data: p } = await db().from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) throw new NotFoundError();
  if (p.status === to) return;
  if (!allowedTransitions(p.status).includes(to)) throw new ValidationError(`لا يمكن الانتقال من "${p.status}" إلى "${to}".`);
  if (to === "cancelled" && !opts.reason?.trim()) throw new ValidationError("سبب الإلغاء مطلوب.", { reason: "مطلوب" });

  if (to === "completed") return completeProject(bos, id, opts);

  const patch: Updates<"projects"> = { status: to };
  if (to === "on_hold") patch.previous_status = p.status;
  if (to === "cancelled") patch.cancelled_reason = opts.reason;
  if (p.status === "completed") patch.completed_at = null;
  await db().from("projects").update(patch).eq("id", id);
  await recordStatus("project", id, p.status, to, bos.userId, opts.reason);
  await audit({ actorId: bos.userId, action: "project.status_changed", entityType: "project", entityId: id, oldValue: { status: p.status }, newValue: { status: to }, reason: opts.reason });
  await emitEvent({
    type: "project.status_changed",
    entityType: "project",
    entityId: id,
    summary: `${p.status} → ${to}${opts.reason ? ` (${opts.reason})` : ""}`,
    payload: { project_id: id, from: p.status, to, pm_id: p.pm_id, client_id: p.client_id },
    links: links(p),
    actorId: bos.userId,
    visibility: "client",
  });
  const channel = await ensureProjectChannel(id, null);
  if (channel) await postSystemMessage(channel, `Project status: ${p.status} → ${to}`);
  if (to === "cancelled" && p.deal_id) {
    const { count } = await db().from("invoices").select("id", { count: "exact", head: true }).eq("project_id", id).in("status", ["sent", "partially_paid", "overdue"]);
    if ((count ?? 0) > 0) await emitEvent({ type: "project.cancelled_with_unpaid_invoices", entityType: "project", entityId: id, summary: `Project cancelled with ${count} unpaid invoice(s)`, payload: { project_id: id }, actorId: bos.userId });
  }
}

// Completion gate (§84): tasks, QA, final approval, final payment — unless
// company settings allow otherwise or an authorised override with reason.
export async function completeProject(bos: BosUser, id: string, opts: { reason?: string | null; force?: boolean } = {}) {
  const { data: p } = await db().from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) throw new NotFoundError();
  const blockers = await completionBlockers(id);
  if (blockers.length && !opts.force) {
    throw new ValidationError(`لا يمكن إكمال المشروع: ${blockers.map((b) => blockerLabels[b] ?? b).join("، ")}.`);
  }
  if (blockers.length && opts.force && !opts.reason?.trim()) throw new ValidationError("سبب التجاوز مطلوب.", { reason: "مطلوب" });
  const delivery = await getSetting("delivery");
  const supportUntil = new Date(nowMs() + delivery.support_period_days * 86400000).toISOString().slice(0, 10);
  await db().from("projects").update({ status: "completed", completed_at: nowIso(), progress: 100, support_until: supportUntil, health: "healthy", health_reason: null }).eq("id", id);
  await recordStatus("project", id, p.status, "completed", bos.userId, opts.force ? `Override: ${opts.reason}` : null);
  await audit({ actorId: bos.userId, action: opts.force ? "project.completed_override" : "project.completed", entityType: "project", entityId: id, oldValue: { status: p.status }, newValue: { status: "completed", support_until: supportUntil }, reason: opts.reason, metadata: { blockers } });
  await emitEvent({
    type: "project.completed",
    entityType: "project",
    entityId: id,
    summary: `Project completed: ${p.name}${opts.force ? " (override)" : ""}`,
    payload: { project_id: id, client_id: p.client_id, deal_id: p.deal_id, pm_id: p.pm_id, support_until: supportUntil },
    links: links(p),
    actorId: bos.userId,
    visibility: "client",
  });
}

export async function requestFinalApproval(bos: BosUser, id: string) {
  const { data: p } = await db().from("projects").select("id, name, client_id, primary_contact_id, deal_id").eq("id", id).maybeSingle();
  if (!p) throw new NotFoundError();
  let contactId = p.primary_contact_id;
  if (!contactId) contactId = (await db().from("clients").select("primary_contact_id").eq("id", p.client_id).maybeSingle()).data?.primary_contact_id ?? null;
  if (!contactId) throw new ValidationError("حدد جهة اتصال أساسية للعميل لطلب الموافقة.");
  await requestApproval({
    type: "final_delivery",
    entityType: "project",
    entityId: id,
    title: `Final delivery approval: ${p.name}`,
    requestedBy: bos.userId,
    steps: [{ contactId }],
    clientVisible: true,
    links: links(p),
  });
}

export async function recordSatisfaction(actorId: string | null, id: string, score: number, comment: string | null) {
  if (score < 1 || score > 10) throw new ValidationError("التقييم من 1 إلى 10.");
  await db().from("projects").update({ satisfaction_score: score, satisfaction_comment: comment }).eq("id", id);
  await audit({ actorId, actorType: actorId ? "user" : "client", action: "project.satisfaction_recorded", entityType: "project", entityId: id, newValue: { score, comment } });
  await emitEvent({ type: "project.satisfaction_recorded", entityType: "project", entityId: id, summary: `Client satisfaction: ${score}/10`, payload: { score }, actorId, actorType: actorId ? "user" : "client" });
}

export async function projectFinancials(id: string) {
  const { data } = await db().rpc("bos_project_financials", { p_project: id });
  const f = (data ?? {}) as Record<string, number | string>;
  const revenue = f.revenue_basis === "invoiced" ? Number(f.invoiced) : Number(f.collected);
  const cost = ["employee_cost", "freelancer_cost", "vendor_cost", "infrastructure_cost", "third_party_cost", "other_cost"].reduce((s, k) => s + Number(f[k] ?? 0), 0);
  const profit = revenue - cost;
  return { ...f, revenue, cost, profit, margin: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : null } as Record<string, number | string | null> & { revenue: number; cost: number; profit: number; margin: number | null; currency: string };
}

export async function projectUserIds(id: string): Promise<string[]> {
  const { data } = await db().from("project_members").select("user_id").eq("project_id", id);
  return (data ?? []).map((m) => m.user_id);
}
