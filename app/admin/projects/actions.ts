"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, can } from "@/lib/bos/auth";
import { assertCanAccess, canAccessEntity } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { zonedToUtc } from "@/lib/bos/format";
import {
  assignPm,
  changeProjectStatus,
  createProject,
  recordSatisfaction,
  requestFinalApproval,
  setMember,
  updateProject,
  type ProjectStatus,
} from "@/services/bos/projects";
import {
  addChecklistItem,
  addDependency,
  advanceChangeRequest,
  archiveTask,
  createChangeRequest,
  createTask,
  logTime,
  removeDependency,
  requestMilestoneApproval,
  saveIssue,
  saveMilestone,
  setIssueStatus,
  setMilestoneStatus,
  setTaskStatus,
  startTimer,
  stopTimer,
  toggleChecklistItem,
  updateChangeRequestAssessment,
  updateTask,
  type TaskInput,
} from "@/services/bos/delivery";

function refreshProject(id?: string | null) {
  revalidatePath("/admin/projects", "layout");
  if (id) revalidatePath(`/admin/projects/${id}`);
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  name: zf.required("اسم المشروع", 200),
  client_id: zf.uuid("الحساب"),
  primary_contact_id: zf.optionalUuid(),
  pm_id: zf.optionalUuid(),
  budget: z.preprocess((v) => (v === "" ? "0" : v), zf.money("الميزانية")),
  currency: zf.currency(),
  scope: zf.optionalText(50000),
  start_date: zf.optionalDate(),
  deadline: zf.optionalDate(),
});

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("createProject", async () => {
    const { bos } = await authorize("projects.create");
    const v = parseForm(projectSchema, formData);
    const project = await createProject(bos, { ...v, scope: v.scope ?? null });
    id = project.id;
    refreshProject();
    return { ok: true };
  }, "تعذر إنشاء المشروع.");
  if (result.ok && id) redirect(`/admin/projects/${id}`);
  return result;
}

export async function updateProjectAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateProject", async () => {
    const { bos } = await authorize("projects.update");
    await assertCanAccess(bos, "project", id, "update");
    const v = parseForm(projectSchema, formData);
    const input = { ...v, scope: v.scope ?? null } as Record<string, unknown>;
    // Budget is sensitive and changes go through change requests unless the
    // user can manage projects with sensitive access.
    if (!can(bos, "projects.view_sensitive")) {
      delete input.budget;
      delete input.currency;
    }
    if (!can(bos, "projects.assign")) delete input.pm_id;
    await updateProject(bos, id, input);
    refreshProject(id);
    return { ok: true, message: "تم حفظ المشروع" };
  });
}

export async function changeProjectStatusAction(id: string, to: ProjectStatus, reason?: string, force?: boolean): Promise<ActionState> {
  return handleAction("changeProjectStatus", async () => {
    const { bos } = await authorize("projects.update");
    await assertCanAccess(bos, "project", id, "update");
    if (force && !can(bos, "projects.manage", "all")) throw new ValidationError("تجاوز شروط الإكمال يتطلب صلاحية إدارة كاملة.");
    await changeProjectStatus(bos, id, to, { reason: reason ?? null, force: Boolean(force) });
    refreshProject(id);
    return { ok: true, message: "تم تحديث حالة المشروع" };
  });
}

export async function assignPmAction(id: string, pmId: string): Promise<ActionState> {
  return handleAction("assignPm", async () => {
    const { bos } = await authorize("projects.assign");
    await assignPm(bos, id, pmId);
    refreshProject(id);
    return { ok: true, message: "تم تعيين مدير المشروع" };
  });
}

export async function setMemberAction(id: string, userId: string, roleLabel: string | null, allocation: number | null, remove = false): Promise<ActionState> {
  return handleAction("setMember", async () => {
    const { bos } = await authorize("projects.manage");
    await assertCanAccess(bos, "project", id, "update");
    await setMember(bos, id, userId, roleLabel, allocation, remove);
    refreshProject(id);
    return { ok: true };
  });
}

export async function addMemberFormAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addMember", async () => {
    const v = parseForm(z.object({ user_id: zf.uuid("الموظف"), role_label: zf.optionalText(100), allocation: z.preprocess((x) => (x === "" ? null : x), z.coerce.number().int().min(0).max(100).nullable()) }), formData);
    return setMemberAction(id, v.user_id, v.role_label ?? null, v.allocation);
  });
}

export async function requestFinalApprovalAction(id: string): Promise<ActionState> {
  return handleAction("requestFinalApproval", async () => {
    const { bos } = await authorize("projects.update");
    await assertCanAccess(bos, "project", id, "update");
    await requestFinalApproval(bos, id);
    refreshProject(id);
    return { ok: true, message: "أُرسل طلب موافقة التسليم النهائي للعميل" };
  });
}

export async function recordSatisfactionAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("recordSatisfaction", async () => {
    const { bos } = await authorize("projects.update");
    await assertCanAccess(bos, "project", id, "update");
    const v = parseForm(z.object({ score: zf.int(1, 10), comment: zf.optionalText(2000) }), formData);
    await recordSatisfaction(bos.userId, id, v.score, v.comment ?? null);
    refreshProject(id);
    return { ok: true, message: "تم تسجيل تقييم العميل" };
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const taskSchema = z.object({
  title: zf.required("عنوان المهمة", 300),
  description: zf.optionalText(20000),
  assigned_to: zf.optionalUuid(),
  project_id: zf.optionalUuid(),
  milestone_id: zf.optionalUuid(),
  deal_id: zf.optionalUuid(),
  client_id: zf.optionalUuid(),
  lead_id: zf.optionalUuid(),
  parent_task_id: zf.optionalUuid(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_date: zf.optionalDate(),
  start_date: zf.optionalDate(),
  estimated_hours: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(0).max(10000).nullable()),
  is_required: zf.checkbox(),
  client_visible: zf.checkbox(),
});

function toTaskInput(v: z.infer<typeof taskSchema>): TaskInput {
  return {
    title: v.title,
    description: v.description ?? null,
    assigned_to: v.assigned_to,
    project_id: v.project_id,
    milestone_id: v.milestone_id,
    deal_id: v.deal_id,
    client_id: v.client_id,
    lead_id: v.lead_id,
    parent_task_id: v.parent_task_id,
    priority: v.priority,
    due_date: v.due_date,
    start_date: v.start_date,
    estimated_minutes: v.estimated_hours === null ? null : Math.round(v.estimated_hours * 60),
    is_required: v.is_required,
    client_visible: v.client_visible,
  };
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  let stay = false;
  const result = await handleAction("createTask", async () => {
    const { bos } = await authorize("tasks.create");
    const v = parseForm(taskSchema, formData);
    stay = formData.get("stay") === "1";
    if (v.project_id) await assertCanAccess(bos, "project", v.project_id, "read");
    if (v.deal_id) await assertCanAccess(bos, "deal", v.deal_id, "read");
    if (v.assigned_to && v.assigned_to !== bos.userId && !can(bos, "tasks.assign") && !can(bos, "projects.assign")) {
      throw new ValidationError("لا يمكنك إسناد مهام لموظفين آخرين.", { assigned_to: "غير مسموح" });
    }
    const task = await createTask(bos, toTaskInput(v));
    id = task.id;
    refreshProject(task.project_id);
    return { ok: true, message: "تم إنشاء المهمة" };
  }, "تعذر إنشاء المهمة.");
  if (result.ok && id && !stay) redirect(`/admin/projects/tasks/${id}`);
  return result;
}

async function assertTaskAccess(id: string, action: "read" | "update") {
  const { bos } = await authorize(action === "read" ? "tasks.read" : "tasks.update");
  if (!(await canAccessEntity(bos, "task", id, action))) throw new ValidationError("ليس لديك صلاحية على هذه المهمة.");
  return bos;
}

export async function updateTaskAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateTask", async () => {
    const bos = await assertTaskAccess(id, "update");
    const input = toTaskInput(parseForm(taskSchema, formData));
    if (!can(bos, "tasks.assign") && !can(bos, "projects.assign")) {
      const { data } = await db().from("tasks").select("assigned_to").eq("id", id).single();
      input.assigned_to = data?.assigned_to ?? null;
    }
    await updateTask(bos, id, input);
    refreshProject(input.project_id);
    revalidatePath(`/admin/projects/tasks/${id}`);
    return { ok: true, message: "تم حفظ المهمة" };
  });
}

export async function setTaskStatusAction(id: string, status: "pending" | "in_progress" | "blocked" | "completed" | "cancelled"): Promise<ActionState> {
  return handleAction("setTaskStatus", async () => {
    const bos = await assertTaskAccess(id, "update");
    await setTaskStatus(bos, id, status);
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function archiveTaskAction(id: string): Promise<ActionState> {
  return handleAction("archiveTask", async () => {
    const bos = await assertTaskAccess(id, "update");
    await archiveTask(bos, id);
    revalidatePath("/admin/projects", "layout");
    return { ok: true };
  });
}

export async function addDependencyAction(id: string, dependsOn: string): Promise<ActionState> {
  return handleAction("addDependency", async () => {
    const bos = await assertTaskAccess(id, "update");
    await addDependency(bos, id, dependsOn);
    revalidatePath(`/admin/projects/tasks/${id}`);
    return { ok: true };
  });
}

export async function removeDependencyAction(id: string, dependsOn: string): Promise<ActionState> {
  return handleAction("removeDependency", async () => {
    const bos = await assertTaskAccess(id, "update");
    await removeDependency(bos, id, dependsOn);
    revalidatePath(`/admin/projects/tasks/${id}`);
    return { ok: true };
  });
}

export async function addChecklistItemAction(id: string, label: string): Promise<ActionState> {
  return handleAction("addChecklistItem", async () => {
    await assertTaskAccess(id, "update");
    await addChecklistItem(id, label);
    revalidatePath(`/admin/projects/tasks/${id}`);
    return { ok: true };
  });
}

export async function toggleChecklistItemAction(taskId: string, itemId: string, done: boolean): Promise<ActionState> {
  return handleAction("toggleChecklist", async () => {
    const bos = await assertTaskAccess(taskId, "update");
    await toggleChecklistItem(bos, itemId, done);
    revalidatePath(`/admin/projects/tasks/${taskId}`);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export async function startTimerAction(taskId: string | null, projectId: string | null): Promise<ActionState> {
  return handleAction("startTimer", async () => {
    const { bos } = await authorize("timesheets.create");
    if (taskId) await assertTaskAccess(taskId, "read");
    await startTimer(bos, taskId, projectId, null);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "بدأ المؤقت" };
  });
}

export async function stopTimerAction(): Promise<ActionState> {
  return handleAction("stopTimer", async () => {
    const { bos } = await authorize("timesheets.create");
    await stopTimer(bos);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "تم تسجيل الوقت" };
  });
}

const timeSchema = z.object({
  project_id: zf.optionalUuid(),
  task_id: zf.optionalUuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "وقت غير صالح"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "وقت غير صالح"),
  description: zf.optionalText(1000),
  billable: zf.checkbox(),
});

export async function logTimeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("logTime", async () => {
    const { bos } = await authorize("timesheets.create");
    const v = parseForm(timeSchema, formData);
    if (!v.project_id && !v.task_id) throw new ValidationError("اختر مشروعاً أو مهمة.", { project_id: "مطلوب" });
    if (v.task_id) await assertTaskAccess(v.task_id, "read");
    else if (v.project_id) await assertCanAccess(bos, "project", v.project_id, "read");
    // Times are entered in the employee's own timezone (§103).
    const toIso = (t: string) => zonedToUtc(v.date, t, bos.employee.timezone);
    const r = await logTime(bos, { user_id: bos.userId, project_id: v.project_id, task_id: v.task_id, started_at: toIso(v.start_time), ended_at: toIso(v.end_time), description: v.description ?? null, billable: v.billable });
    refreshProject(v.project_id);
    return { ok: true, message: r.overlaps ? "تم التسجيل — تنبيه: يتداخل مع إدخال وقت آخر" : "تم تسجيل الوقت" };
  });
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

const milestoneSchema = z.object({
  name: zf.required("اسم المرحلة", 200),
  description: zf.optionalText(5000),
  due_date: zf.optionalDate(),
  owner_id: zf.optionalUuid(),
  deliverables: zf.optionalText(5000),
  requires_client_approval: zf.checkbox(),
});

export async function saveMilestoneAction(projectId: string, milestoneId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveMilestone", async () => {
    const { bos } = await authorize(milestoneId ? "milestones.update" : "milestones.create");
    await assertCanAccess(bos, "project", projectId, "update");
    const v = parseForm(milestoneSchema, formData);
    await saveMilestone(bos, projectId, milestoneId, { ...v, description: v.description ?? null, deliverables: v.deliverables ?? null });
    refreshProject(projectId);
    return { ok: true, message: "تم حفظ المرحلة" };
  });
}

export async function setMilestoneStatusAction(id: string, status: "not_started" | "in_progress" | "blocked" | "completed"): Promise<ActionState> {
  return handleAction("setMilestoneStatus", async () => {
    const { bos } = await authorize("milestones.update");
    const { data } = await db().from("milestones").select("project_id").eq("id", id).single();
    await assertCanAccess(bos, "project", data!.project_id, "update");
    await setMilestoneStatus(bos, id, status);
    refreshProject(data!.project_id);
    return { ok: true };
  });
}

export async function requestMilestoneApprovalAction(id: string, type: "milestone" | "design"): Promise<ActionState> {
  return handleAction("requestMilestoneApproval", async () => {
    const { bos } = await authorize("approvals.read");
    const { data } = await db().from("milestones").select("project_id").eq("id", id).single();
    await assertCanAccess(bos, "project", data!.project_id, "update");
    await requestMilestoneApproval(bos, id, type);
    refreshProject(data!.project_id);
    return { ok: true, message: "أُرسل طلب الموافقة للعميل" };
  });
}

// ---------------------------------------------------------------------------
// Change requests & issues
// ---------------------------------------------------------------------------

const crSchema = z.object({
  title: zf.required("الطلب", 300),
  description: zf.optionalText(10000),
  reason: zf.optionalText(5000),
  impact: zf.optionalText(5000),
  additional_cost: z.preprocess((v) => (v === "" ? "0" : v), zf.money("التكلفة الإضافية")),
  currency: zf.currency(),
  additional_days: z.preprocess((v) => (v === "" ? 0 : v), z.coerce.number().int().min(0).max(3650)),
  requested_by_contact_id: zf.optionalUuid(),
});

export async function createChangeRequestAction(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("createChangeRequest", async () => {
    const { bos } = await authorize("change_requests.create");
    await assertCanAccess(bos, "project", projectId, "read");
    const v = parseForm(crSchema, formData);
    const cr = await createChangeRequest({ userId: bos.userId }, projectId, { ...v, description: v.description ?? null, reason: v.reason ?? null, impact: v.impact ?? null });
    id = cr.id;
    refreshProject(projectId);
    return { ok: true };
  }, "تعذر إنشاء طلب التغيير.");
  if (result.ok && id) redirect(`/admin/projects/change-requests/${id}`);
  return result;
}

export async function assessChangeRequestAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("assessChangeRequest", async () => {
    const { bos } = await authorize("change_requests.update");
    const { data } = await db().from("change_requests").select("project_id").eq("id", id).single();
    await assertCanAccess(bos, "project", data!.project_id, "update");
    const v = parseForm(crSchema.pick({ impact: true, additional_cost: true, currency: true, additional_days: true }), formData);
    await updateChangeRequestAssessment(bos, id, { ...v, impact: v.impact ?? null });
    revalidatePath(`/admin/projects/change-requests/${id}`);
    return { ok: true, message: "تم حفظ التقييم" };
  });
}

export async function advanceChangeRequestAction(id: string, to: string, reason?: string): Promise<ActionState> {
  return handleAction("advanceChangeRequest", async () => {
    const { bos } = await authorize(to === "added_to_project" ? "change_requests.approve" : "change_requests.update");
    const { data } = await db().from("change_requests").select("project_id").eq("id", id).single();
    await assertCanAccess(bos, "project", data!.project_id, "update");
    await advanceChangeRequest(bos, id, to, reason ?? null);
    revalidatePath(`/admin/projects/change-requests/${id}`);
    refreshProject(data!.project_id);
    return { ok: true };
  });
}

const issueSchema = z.object({
  title: zf.required("عنوان المشكلة", 300),
  description: zf.optionalText(10000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  assigned_to: zf.optionalUuid(),
});

export async function saveIssueAction(projectId: string, issueId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveIssue", async () => {
    const { bos } = await authorize(issueId ? "issues.update" : "issues.create");
    await assertCanAccess(bos, "project", projectId, "read");
    const v = parseForm(issueSchema, formData);
    await saveIssue(bos, projectId, issueId, { ...v, description: v.description ?? null });
    refreshProject(projectId);
    return { ok: true, message: "تم الحفظ" };
  });
}

export async function setIssueStatusAction(id: string, status: "open" | "in_progress" | "resolved" | "closed"): Promise<ActionState> {
  return handleAction("setIssueStatus", async () => {
    const { bos } = await authorize("issues.update");
    const { data } = await db().from("issues").select("project_id").eq("id", id).single();
    await assertCanAccess(bos, "project", data!.project_id, "read");
    await setIssueStatus(bos, id, status);
    refreshProject(data!.project_id);
    return { ok: true };
  });
}
