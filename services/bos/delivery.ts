import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { db, dec, type Tables } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import { myProjectIds, teamProjectIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent, dispatchPendingEvents } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { requestApproval } from "@/services/bos/approvals";
import { addDays, todayIn } from "@/lib/bos/format";

export type Task = Tables<"tasks">;
export type TaskStatus = Task["status"];

// ---------------------------------------------------------------------------
// Tasks (§14, §24)
// ---------------------------------------------------------------------------

export type TaskView = "my" | "team" | "overdue" | "today" | "upcoming" | "completed" | "all";

export interface TaskFilters {
  view?: string;
  q?: string;
  project?: string;
  status?: string;
  priority?: string;
  assigned?: string;
  page?: number;
}

export async function listTasks(bos: BosUser, scope: Scope, f: TaskFilters) {
  const pageSize = 40;
  const page = Math.max(1, f.page ?? 1);
  const view = (f.view ?? "my") as TaskView;
  const today = todayIn(bos.employee.timezone);
  let q = db()
    .from("tasks")
    .select("id, title, status, priority, due_date, assigned_to, project_id, milestone_id, deal_id, client_id, parent_task_id, estimated_minutes, actual_minutes, completed_at, projects(name), milestones(name), deals(name), clients(name)", { count: "exact" })
    .is("archived_at", null);

  if (view === "my") {
    q = q.eq("assigned_to", bos.userId);
  } else if (scope !== "all") {
    const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
    const projects = scope === "team" ? await teamProjectIds(bos) : await myProjectIds(bos);
    const parts = [`assigned_to.in.(${users.join(",")})`, `created_by.in.(${users.join(",")})`];
    if (projects.length) parts.push(`project_id.in.(${projects.join(",")})`);
    q = q.or(parts.join(","));
  }
  if (view === "team" && scope === "all" && !f.assigned) {
    const team = await getTeamUserIds(bos);
    q = q.in("assigned_to", team);
  }

  if (view === "overdue") q = q.eq("status", "overdue");
  else if (view === "today") q = q.eq("due_date", today).in("status", ["pending", "in_progress", "blocked"]);
  else if (view === "upcoming") q = q.gt("due_date", today).lte("due_date", addDays(today, 14)).in("status", ["pending", "in_progress", "blocked"]);
  else if (view === "completed") q = q.eq("status", "completed");
  else if (!f.status) q = q.in("status", ["pending", "in_progress", "blocked", "overdue"]);

  if (f.status) q = q.eq("status", f.status as TaskStatus);
  if (f.project) q = q.eq("project_id", f.project);
  if (f.priority) q = q.eq("priority", f.priority as Task["priority"]);
  if (f.assigned) q = q.eq("assigned_to", f.assigned);
  if (f.q) q = q.ilike("title", `%${f.q.replace(/[%_]/g, " ")}%`);

  const order = view === "completed" ? q.order("completed_at", { ascending: false }) : q.order("due_date", { ascending: true, nullsFirst: false }).order("priority", { ascending: false });
  const { data, count, error } = await order.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export interface TaskInput {
  title: string;
  description: string | null;
  assigned_to: string | null;
  project_id: string | null;
  milestone_id: string | null;
  deal_id: string | null;
  client_id: string | null;
  lead_id: string | null;
  parent_task_id: string | null;
  priority: Task["priority"];
  due_date: string | null;
  start_date: string | null;
  estimated_minutes: number | null;
  is_required: boolean;
}

async function inheritLinks(input: TaskInput): Promise<TaskInput> {
  const out = { ...input };
  if (out.parent_task_id) {
    const { data: parent } = await db().from("tasks").select("project_id, milestone_id, client_id, deal_id, parent_task_id").eq("id", out.parent_task_id).maybeSingle();
    if (!parent) throw new ValidationError("المهمة الأم غير موجودة.");
    let depth = 1;
    let cursor = parent.parent_task_id;
    while (cursor && depth < 5) {
      depth++;
      cursor = (await db().from("tasks").select("parent_task_id").eq("id", cursor).maybeSingle()).data?.parent_task_id ?? null;
    }
    if (depth >= 3) throw new ValidationError("الحد الأقصى لعمق المهام الفرعية 3 مستويات.");
    out.project_id ??= parent.project_id;
    out.milestone_id ??= parent.milestone_id;
    out.client_id ??= parent.client_id;
    out.deal_id ??= parent.deal_id;
  }
  if (out.milestone_id && !out.project_id) out.project_id = (await db().from("milestones").select("project_id").eq("id", out.milestone_id).maybeSingle()).data?.project_id ?? null;
  if (out.project_id && !out.client_id) out.client_id = (await db().from("projects").select("client_id").eq("id", out.project_id).maybeSingle()).data?.client_id ?? null;
  if (out.deal_id && !out.client_id) out.client_id = (await db().from("deals").select("client_id").eq("id", out.deal_id).maybeSingle()).data?.client_id ?? null;
  if (out.due_date && out.start_date && out.due_date < out.start_date) throw new ValidationError("تاريخ الاستحقاق قبل تاريخ البدء.", { due_date: "غير صالح" });
  return out;
}

function taskLinks(t: Pick<Task, "project_id" | "deal_id" | "client_id" | "lead_id">) {
  return [
    { type: "project", id: t.project_id },
    { type: "deal", id: t.deal_id },
    { type: "client", id: t.client_id },
    { type: "lead", id: t.lead_id },
  ];
}

export async function createTask(bos: BosUser, raw: TaskInput) {
  const input = await inheritLinks(raw);
  const { data, error } = await db().from("tasks").insert({ ...input, created_by: bos.userId }).select("*").single();
  if (error) throw error;
  await recordStatus("task", data.id, null, "pending", bos.userId);
  await emitEvent({ type: "task.created", entityType: "task", entityId: data.id, summary: `Task created: ${data.title}`, payload: { assignee_user_id: data.assigned_to, project_id: data.project_id }, links: taskLinks(data), actorId: bos.userId });
  if (data.assigned_to && data.assigned_to !== bos.userId) {
    await emitEvent({ type: "task.assigned", entityType: "task", entityId: data.id, summary: `Task assigned: ${data.title}`, payload: { assignee_user_id: data.assigned_to, project_id: data.project_id }, actorId: bos.userId });
  }
  return data;
}

export async function updateTask(bos: BosUser, id: string, raw: TaskInput) {
  const { data: before } = await db().from("tasks").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  const input = await inheritLinks({ ...raw, parent_task_id: raw.parent_task_id === id ? null : raw.parent_task_id });
  // Moving the due date of an overdue task into the future re-opens it.
  const reopenFromOverdue = before.status === "overdue" && input.due_date && input.due_date >= todayIn(bos.employee.timezone);
  const { error } = await db().from("tasks").update({ ...input, ...(reopenFromOverdue ? { status: "pending" as const } : {}) }).eq("id", id);
  if (error) throw error;
  const fields = ["title", "assigned_to", "due_date", "priority", "estimated_minutes", "is_required", "milestone_id"] as const;
  const changed = fields.filter((k) => String(before[k] ?? "") !== String(input[k] ?? ""));
  if (changed.length) {
    await audit({ actorId: bos.userId, action: "task.updated", entityType: "task", entityId: id, oldValue: Object.fromEntries(changed.map((k) => [k, before[k]])), newValue: Object.fromEntries(changed.map((k) => [k, input[k]])) });
  }
  if (reopenFromOverdue) await recordStatus("task", id, "overdue", "pending", bos.userId, "Due date moved");
  if (input.assigned_to && input.assigned_to !== before.assigned_to) {
    await emitEvent({ type: "task.assigned", entityType: "task", entityId: id, summary: `Task assigned: ${input.title}`, payload: { assignee_user_id: input.assigned_to, previous_assignee_user_id: before.assigned_to, project_id: input.project_id }, actorId: bos.userId });
  }
}

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "blocked", "completed", "cancelled"],
  in_progress: ["pending", "blocked", "completed", "cancelled"],
  blocked: ["pending", "in_progress", "completed", "cancelled"],
  overdue: ["in_progress", "blocked", "completed", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["pending"],
};

export async function setTaskStatus(bos: BosUser, id: string, to: TaskStatus) {
  const { data: t } = await db().from("tasks").select("*").eq("id", id).maybeSingle();
  if (!t) throw new NotFoundError();
  if (t.status === to) return;
  if (!taskTransitions[t.status].includes(to)) throw new ValidationError(`لا يمكن الانتقال من ${t.status} إلى ${to}.`);
  if (to === "completed") {
    const { data: deps } = await db().from("task_dependencies").select("depends_on_task_id, tasks!task_dependencies_depends_on_task_id_fkey(title, status)").eq("task_id", id);
    const blocking = (deps ?? []).filter((d) => !["completed", "cancelled"].includes((d.tasks as unknown as { status: string }).status));
    if (blocking.length) throw new ValidationError(`المهمة معتمدة على مهام غير مكتملة: ${blocking.map((d) => (d.tasks as unknown as { title: string }).title).join("، ")}.`);
    const { count } = await db().from("tasks").select("id", { count: "exact", head: true }).eq("parent_task_id", id).is("archived_at", null).not("status", "in", "(completed,cancelled)");
    if ((count ?? 0) > 0) throw new ValidationError("أكمل المهام الفرعية أولاً.");
  }
  await db().from("tasks").update({ status: to, completed_at: to === "completed" ? nowIso() : null }).eq("id", id);
  await recordStatus("task", id, t.status, to, bos.userId);
  if (t.status === "completed") await audit({ actorId: bos.userId, action: "task.reopened", entityType: "task", entityId: id });
  await emitEvent({
    type: to === "completed" ? "task.completed" : "task.status_changed",
    entityType: "task",
    entityId: id,
    summary: to === "completed" ? `Task completed: ${t.title}` : `${t.title}: ${t.status} → ${to}`,
    payload: { project_id: t.project_id, creator_user_id: t.created_by, assignee_user_id: t.assigned_to, to },
    links: taskLinks(t),
    actorId: bos.userId,
  });
  if (t.project_id) await db().rpc("bos_recompute_project_health", { p_project: t.project_id });
}

export async function addDependency(bos: BosUser, taskId: string, dependsOn: string) {
  if (taskId === dependsOn) throw new ValidationError("لا يمكن أن تعتمد المهمة على نفسها.");
  // Cycle detection: walk dependencies of `dependsOn`.
  const stack = [dependsOn];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) throw new ValidationError("هذا الاعتماد ينشئ حلقة دائرية.");
    if (seen.has(cur)) continue;
    seen.add(cur);
    const { data } = await db().from("task_dependencies").select("depends_on_task_id").eq("task_id", cur);
    for (const d of data ?? []) stack.push(d.depends_on_task_id);
  }
  const { error } = await db().from("task_dependencies").insert({ task_id: taskId, depends_on_task_id: dependsOn });
  if (error && (error as { code?: string }).code !== "23505") throw error;
  await audit({ actorId: bos.userId, action: "task.dependency_added", entityType: "task", entityId: taskId, newValue: { depends_on: dependsOn } });
}

export async function removeDependency(bos: BosUser, taskId: string, dependsOn: string) {
  await db().from("task_dependencies").delete().eq("task_id", taskId).eq("depends_on_task_id", dependsOn);
  await audit({ actorId: bos.userId, action: "task.dependency_removed", entityType: "task", entityId: taskId, oldValue: { depends_on: dependsOn } });
}

export async function addChecklistItem(taskId: string, label: string) {
  if (!label.trim()) throw new ValidationError("اكتب البند.");
  const { count } = await db().from("task_checklist_items").select("id", { count: "exact", head: true }).eq("task_id", taskId);
  await db().from("task_checklist_items").insert({ task_id: taskId, label: label.trim(), sort_order: count ?? 0 });
}

export async function toggleChecklistItem(bos: BosUser, itemId: string, done: boolean) {
  await db().from("task_checklist_items").update({ is_done: done, done_by: done ? bos.userId : null, done_at: done ? nowIso() : null }).eq("id", itemId);
}

export async function archiveTask(bos: BosUser, id: string) {
  const now = nowIso();
  await db().from("tasks").update({ archived_at: now }).eq("id", id);
  await db().from("tasks").update({ archived_at: now }).eq("parent_task_id", id);
  await audit({ actorId: bos.userId, action: "task.archived", entityType: "task", entityId: id });
}

// ---------------------------------------------------------------------------
// Time tracking (§51)
// ---------------------------------------------------------------------------

export async function startTimer(bos: BosUser, taskId: string | null, projectId: string | null, description: string | null) {
  const { data: running } = await db().from("time_entries").select("id").eq("user_id", bos.userId).is("ended_at", null).maybeSingle();
  if (running) throw new ValidationError("لديك مؤقت يعمل بالفعل. أوقفه أولاً.");
  let project = projectId;
  if (taskId && !project) project = (await db().from("tasks").select("project_id").eq("id", taskId).maybeSingle()).data?.project_id ?? null;
  const { error } = await db().from("time_entries").insert({ user_id: bos.userId, task_id: taskId, project_id: project, started_at: nowIso(), description, source: "timer" });
  if (error) throw error;
}

export async function stopTimer(bos: BosUser) {
  const { data: running } = await db().from("time_entries").select("*").eq("user_id", bos.userId).is("ended_at", null).maybeSingle();
  if (!running) throw new ValidationError("لا يوجد مؤقت يعمل.");
  const end = new Date(Math.max(nowMs(), new Date(running.started_at).getTime() + 60000));
  const capped = new Date(Math.min(end.getTime(), new Date(running.started_at).getTime() + 24 * 3600000));
  const { getSetting } = await import("@/lib/bos/settings");
  const needs = (await getSetting("time_tracking")).approval === "all";
  await db().from("time_entries").update({ ended_at: capped.toISOString(), ...(needs ? { approval_status: "pending" as const } : {}) }).eq("id", running.id);
  if (needs) await requestTimeApproval(bos, running.project_id, Math.round((capped.getTime() - new Date(running.started_at).getTime()) / 60000));
  await emitEvent({ type: "time.logged", entityType: running.task_id ? "task" : "project", entityId: (running.task_id ?? running.project_id)!, summary: `Time logged (timer)`, payload: { project_id: running.project_id }, actorId: bos.userId });
}

// Notifies the employee's manager (or the timesheet approvers) that hours wait for approval.
async function requestTimeApproval(bos: BosUser, projectId: string | null, minutes: number, userId: string = bos.userId) {
  const c = db();
  const { data: emp } = await c.from("employees").select("full_name, manager_id").eq("user_id", userId).maybeSingle();
  let to: string[] = [];
  if (emp?.manager_id) {
    const { data: m } = await c.from("employees").select("user_id").eq("id", emp.manager_id).maybeSingle();
    if (m?.user_id) to = [m.user_id];
  }
  if (!to.length) {
    const { data } = await c.from("role_permissions").select("roles(user_roles(user_id)), permissions!inner(key)").eq("permissions.key", "timesheets.approve").eq("scope", "all");
    for (const r of data ?? []) for (const u of ((r.roles as unknown as { user_roles: { user_id: string }[] })?.user_roles ?? [])) to.push(u.user_id);
  }
  to = [...new Set(to)].filter((u) => u !== userId).slice(0, 10);
  if (!to.length) return;
  const { data: p } = projectId ? await c.from("projects").select("name").eq("id", projectId).maybeSingle() : { data: null };
  await emitEvent({ type: "time.approval_requested", entityType: projectId ? "project" : "employee", entityId: projectId ?? userId, summary: `Hours awaiting approval: ${emp?.full_name ?? ""}`, actorId: bos.userId, payload: { who: emp?.full_name ?? "", hours: (minutes / 60).toFixed(1), project: p?.name ?? "—", notify_user_ids: to } });
}

export async function logTime(bos: BosUser, input: { user_id: string; project_id: string | null; task_id: string | null; started_at: string; ended_at: string; description: string | null; billable: boolean }) {
  const start = new Date(input.started_at);
  const end = new Date(input.ended_at);
  if (!(end > start)) throw new ValidationError("وقت الانتهاء يجب أن يكون بعد البداية.", { ended_at: "غير صالح" });
  if (end.getTime() - start.getTime() > 24 * 3600000) throw new ValidationError("الحد الأقصى 24 ساعة للإدخال الواحد.");
  if (end.getTime() > nowMs() + 5 * 60000) throw new ValidationError("لا يمكن تسجيل وقت في المستقبل.");
  let project = input.project_id;
  if (input.task_id && !project) project = (await db().from("tasks").select("project_id").eq("id", input.task_id).maybeSingle()).data?.project_id ?? null;
  const { data: overlap } = await db().from("time_entries").select("id").eq("user_id", input.user_id).lt("started_at", end.toISOString()).gt("ended_at", start.toISOString()).limit(1).maybeSingle();
  const { getSetting } = await import("@/lib/bos/settings");
  const mode = (await getSetting("time_tracking")).approval;
  // An approver logging for someone else counts as approved; nobody approves their own hours.
  const byApprover = input.user_id !== bos.userId && bos.permissions.get("timesheets.approve") === "all";
  const approval = mode === "none" ? "not_required" : byApprover ? "approved" : "pending";
  const { error } = await db().from("time_entries").insert({ ...input, project_id: project, started_at: start.toISOString(), ended_at: end.toISOString(), source: "manual", approval_status: approval, ...(approval === "approved" ? { approved_by: bos.userId, approved_at: nowIso() } : {}) });
  if (error) throw error;
  if (approval === "pending") await requestTimeApproval(bos, project, Math.round((end.getTime() - start.getTime()) / 60000), input.user_id);
  await audit({ actorId: bos.userId, action: "time.logged", entityType: input.task_id ? "task" : "project", entityId: input.task_id ?? project, newValue: { minutes: Math.round((end.getTime() - start.getTime()) / 60000), for_user: input.user_id }, metadata: { overlaps_existing: Boolean(overlap) } });
  return { overlaps: Boolean(overlap) };
}

// ---------------------------------------------------------------------------
// Milestones (§23)
// ---------------------------------------------------------------------------

export interface MilestoneInput {
  name: string;
  description: string | null;
  due_date: string | null;
  owner_id: string | null;
  deliverables: string | null;
  requires_client_approval: boolean;
}

export async function saveMilestone(bos: BosUser, projectId: string, id: string | null, input: MilestoneInput) {
  if (id) {
    const { data: before } = await db().from("milestones").select("*").eq("id", id).maybeSingle();
    if (!before || before.project_id !== projectId) throw new NotFoundError();
    await db().from("milestones").update({ ...input, approval_status: input.requires_client_approval ? (before.approval_status === "not_required" ? "pending" : before.approval_status) : "not_required" }).eq("id", id);
    await audit({ actorId: bos.userId, action: "milestone.updated", entityType: "project", entityId: projectId, oldValue: { name: before.name, due_date: before.due_date }, newValue: { name: input.name, due_date: input.due_date }, metadata: { milestone_id: id } });
    return id;
  }
  const { count } = await db().from("milestones").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const { data, error } = await db()
    .from("milestones")
    .insert({ ...input, project_id: projectId, sort_order: (count ?? 0) + 1, approval_status: input.requires_client_approval ? "pending" : "not_required" })
    .select("id")
    .single();
  if (error) throw error;
  await emitEvent({ type: "milestone.created", entityType: "project", entityId: projectId, summary: `Milestone added: ${input.name}`, payload: { milestone_id: data.id }, actorId: bos.userId });
  return data.id;
}

export async function setMilestoneStatus(bos: BosUser, id: string, to: Tables<"milestones">["status"]) {
  const { data: m } = await db().from("milestones").select("*").eq("id", id).maybeSingle();
  if (!m) throw new NotFoundError();
  if (to === "completed") {
    const { data: deps } = await db().from("milestone_dependencies").select("depends_on_id, milestones!milestone_dependencies_depends_on_id_fkey(name, status)").eq("milestone_id", id);
    const blocking = (deps ?? []).filter((d) => (d.milestones as unknown as { status: string }).status !== "completed");
    if (blocking.length) throw new ValidationError(`هذه المرحلة تعتمد على مراحل غير مكتملة: ${blocking.map((d) => (d.milestones as unknown as { name: string }).name).join("، ")}.`);
    const { count } = await db().from("tasks").select("id", { count: "exact", head: true }).eq("milestone_id", id).eq("is_required", true).is("archived_at", null).not("status", "in", "(completed,cancelled)");
    if ((count ?? 0) > 0) throw new ValidationError(`توجد ${count} مهمة مطلوبة غير مكتملة في هذه المرحلة.`);
    if (m.requires_client_approval && m.approval_status !== "approved") throw new ValidationError("هذه المرحلة تتطلب موافقة العميل قبل إكمالها.");
  }
  await db().from("milestones").update({ status: to, completed_at: to === "completed" ? nowIso() : null, progress: to === "completed" ? 100 : m.progress }).eq("id", id);
  await recordStatus("milestone", id, m.status, to, bos.userId);
  await emitEvent({
    type: to === "completed" ? "milestone.completed" : "milestone.status_changed",
    entityType: "project",
    entityId: m.project_id,
    summary: `${m.name}: ${m.status} → ${to}`,
    payload: { milestone_id: id, project_id: m.project_id },
    actorId: bos.userId,
    visibility: "client",
  });
  if (to === "completed") {
    // Milestone-triggered installments are invoiced when the milestone completes.
    const { data: schedules } = await db().from("payment_schedules").select("id").eq("milestone_id", id).eq("status", "scheduled");
    for (const s of schedules ?? []) await db().rpc("bos_create_invoice_from_schedule", { p_schedule_id: s.id, p_actor: bos.userId });
    await dispatchPendingEvents();
  }
  await db().rpc("bos_recompute_project_progress", { p_project: m.project_id });
  await db().rpc("bos_recompute_project_health", { p_project: m.project_id });
}

export async function requestMilestoneApproval(bos: BosUser, id: string, type: "milestone" | "design") {
  const { data: m } = await db().from("milestones").select("*, projects!inner(name, client_id, primary_contact_id)").eq("id", id).maybeSingle();
  if (!m) throw new NotFoundError();
  const project = m.projects as unknown as { name: string; client_id: string; primary_contact_id: string | null };
  let contactId = project.primary_contact_id;
  if (!contactId) contactId = (await db().from("clients").select("primary_contact_id").eq("id", project.client_id).maybeSingle()).data?.primary_contact_id ?? null;
  if (!contactId) throw new ValidationError("حدد جهة اتصال أساسية للعميل أولاً.");
  await db().from("milestones").update({ approval_status: "pending", requires_client_approval: true }).eq("id", id);
  await requestApproval({
    type,
    entityType: "milestone",
    entityId: id,
    title: `${type === "design" ? "Design approval" : "Milestone approval"}: ${m.name} — ${project.name}`,
    requestedBy: bos.userId,
    steps: [{ contactId }],
    clientVisible: true,
    links: [{ type: "project", id: m.project_id }, { type: "client", id: project.client_id }],
  });
}

// ---------------------------------------------------------------------------
// Change requests (§25)
// ---------------------------------------------------------------------------

export interface ChangeRequestInput {
  title: string;
  description: string | null;
  reason: string | null;
  impact: string | null;
  additional_cost: string;
  currency: string;
  additional_days: number;
  requested_by_contact_id: string | null;
}

export async function createChangeRequest(actor: { userId: string | null; contactId?: string | null }, projectId: string, input: ChangeRequestInput) {
  const { data: p } = await db().from("projects").select("client_id, pm_id, name").eq("id", projectId).maybeSingle();
  if (!p) throw new NotFoundError();
  const { data, error } = await db()
    .from("change_requests")
    .insert({
      ...input,
      additional_cost: dec(input.additional_cost || "0"),
      project_id: projectId,
      client_id: p.client_id,
      requested_by_user_id: actor.userId,
      requested_by_contact_id: input.requested_by_contact_id ?? actor.contactId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordStatus("change_request", data.id, null, "requested", actor.userId);
  await emitEvent({
    type: "change_request.created",
    entityType: "change_request",
    entityId: data.id,
    summary: `${data.cr_number} requested: ${data.title}`,
    payload: { project_id: projectId, pm_id: p.pm_id },
    links: [{ type: "project", id: projectId }, { type: "client", id: p.client_id }],
    actorId: actor.userId,
    actorType: actor.contactId ? "client" : "user",
    visibility: "client",
  });
  return data;
}

export async function updateChangeRequestAssessment(bos: BosUser, id: string, input: Pick<ChangeRequestInput, "impact" | "additional_cost" | "currency" | "additional_days">) {
  const { data: cr } = await db().from("change_requests").select("*").eq("id", id).maybeSingle();
  if (!cr) throw new NotFoundError();
  if (["approved", "added_to_project", "rejected"].includes(cr.status)) throw new ValidationError("لا يمكن تعديل تقييم طلب مغلق.");
  await db().from("change_requests").update({ ...input, additional_cost: dec(input.additional_cost || "0") }).eq("id", id);
  await audit({ actorId: bos.userId, action: "change_request.assessed", entityType: "change_request", entityId: id, oldValue: { cost: cr.additional_cost, days: cr.additional_days }, newValue: { cost: input.additional_cost, days: input.additional_days } });
}

const crFlow: Record<string, string[]> = {
  requested: ["assessment", "rejected"],
  assessment: ["proposal", "client_approval", "rejected"],
  proposal: ["client_approval", "rejected"],
  client_approval: ["rejected"],
  approved: ["added_to_project"],
};

export async function advanceChangeRequest(bos: BosUser, id: string, to: string, reason: string | null) {
  const { data: cr } = await db().from("change_requests").select("*").eq("id", id).maybeSingle();
  if (!cr) throw new NotFoundError();
  if (!crFlow[cr.status]?.includes(to)) throw new ValidationError(`لا يمكن الانتقال من ${cr.status} إلى ${to}.`);
  if (to === "rejected" && !reason?.trim()) throw new ValidationError("سبب الرفض مطلوب.");

  if (to === "client_approval") {
    const { data: project } = await db().from("projects").select("primary_contact_id, client_id").eq("id", cr.project_id).maybeSingle();
    let contactId = cr.requested_by_contact_id ?? project?.primary_contact_id ?? null;
    if (!contactId) contactId = (await db().from("clients").select("primary_contact_id").eq("id", cr.client_id).maybeSingle()).data?.primary_contact_id ?? null;
    if (!contactId) throw new ValidationError("لا توجد جهة اتصال للعميل لطلب الموافقة.");
    await db().from("change_requests").update({ status: "client_approval" }).eq("id", id);
    await recordStatus("change_request", id, cr.status, "client_approval", bos.userId);
    const approval = await requestApproval({
      type: "change_request",
      entityType: "change_request",
      entityId: id,
      title: `${cr.cr_number}: ${cr.title} (+${cr.additional_cost} ${cr.currency}, +${cr.additional_days} days)`,
      requestedBy: bos.userId,
      steps: [{ contactId }],
      clientVisible: true,
      links: [{ type: "project", id: cr.project_id }, { type: "client", id: cr.client_id }],
    });
    await db().from("change_requests").update({ approval_group_id: approval.group_id }).eq("id", id);
    return;
  }
  if (to === "added_to_project") {
    const { error } = await db().rpc("bos_apply_change_request", { p_cr: id, p_actor: bos.userId });
    if (error) throw error;
    await dispatchPendingEvents();
    return;
  }
  await db().from("change_requests").update({ status: to as Tables<"change_requests">["status"], decided_at: to === "rejected" ? nowIso() : null }).eq("id", id);
  await recordStatus("change_request", id, cr.status, to, bos.userId, reason);
  await emitEvent({
    type: to === "rejected" ? "change_request.rejected" : "change_request.status_changed",
    entityType: "change_request",
    entityId: id,
    summary: `${cr.cr_number}: ${cr.status} → ${to}${reason ? ` (${reason})` : ""}`,
    payload: { project_id: cr.project_id },
    links: [{ type: "project", id: cr.project_id }, { type: "client", id: cr.client_id }],
    actorId: bos.userId,
    visibility: "client",
  });
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export async function saveIssue(bos: BosUser, projectId: string, id: string | null, input: { title: string; description: string | null; severity: string; assigned_to: string | null }) {
  if (id) {
    await db().from("issues").update(input).eq("id", id).eq("project_id", projectId);
    await audit({ actorId: bos.userId, action: "issue.updated", entityType: "project", entityId: projectId, newValue: input, metadata: { issue_id: id } });
    return id;
  }
  const { data, error } = await db().from("issues").insert({ ...input, project_id: projectId, reported_by: bos.userId }).select("id").single();
  if (error) throw error;
  await emitEvent({ type: "issue.created", entityType: "project", entityId: projectId, summary: `Issue reported: ${input.title} (${input.severity})`, payload: { issue_id: data.id, assignee_user_id: input.assigned_to, project_id: projectId }, links: [{ type: "issue", id: data.id }], actorId: bos.userId });
  if (input.assigned_to) await emitEvent({ type: "issue.assigned", entityType: "issue", entityId: data.id, summary: `Issue assigned: ${input.title}`, payload: { assignee_user_id: input.assigned_to }, actorId: bos.userId });
  await db().rpc("bos_recompute_project_health", { p_project: projectId });
  return data.id;
}

export async function setIssueStatus(bos: BosUser, id: string, status: "open" | "in_progress" | "resolved" | "closed") {
  const { data: i } = await db().from("issues").select("*").eq("id", id).maybeSingle();
  if (!i) throw new NotFoundError();
  await db().from("issues").update({ status, resolved_at: ["resolved", "closed"].includes(status) ? nowIso() : null }).eq("id", id);
  await recordStatus("issue", id, i.status, status, bos.userId);
  await emitEvent({ type: "issue.status_changed", entityType: "project", entityId: i.project_id, summary: `Issue "${i.title}": ${i.status} → ${status}`, links: [{ type: "issue", id }], actorId: bos.userId });
  await db().rpc("bos_recompute_project_health", { p_project: i.project_id });
}
