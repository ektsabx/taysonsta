import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Client onboarding (§83). Checklists are created by bos_process_deal_won;
// auto items complete from events (see runBuiltins in lib/bos/events.ts),
// manual items are ticked here by PM / Account Manager.

export async function listClientOnboarding(clientId: string) {
  const { data: lists } = await db()
    .from("onboarding_checklists")
    .select("*, deals(id, deal_number, name), projects(id, name, project_number)")
    .eq("subject", "client")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  const ids = (lists ?? []).map((l) => l.id);
  const { data: items } = ids.length ? await db().from("onboarding_items").select("*").in("checklist_id", ids).order("sort_order") : { data: [] };
  return (lists ?? []).map((l) => {
    const its = (items ?? []).filter((i) => i.checklist_id === l.id);
    const required = its.filter((i) => i.required);
    return { ...l, items: its, percent: required.length ? Math.round((required.filter((i) => i.is_done).length / required.length) * 100) : 100 };
  });
}

export async function startClientOnboarding(bos: BosUser, dealId: string) {
  const { data: deal } = await db().from("deals").select("id, client_id, name").eq("id", dealId).maybeSingle();
  if (!deal) throw new NotFoundError();
  const { data: project } = await db().from("projects").select("id").eq("deal_id", dealId).maybeSingle();
  const { data, error } = await db().rpc("bos_start_onboarding", { p_subject: "client", p_template_key: "client_onboarding", p_client: deal.client_id, p_deal: dealId, p_project: (project?.id ?? null) as unknown as string, p_employee: null as unknown as string });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "onboarding.started", entityType: "client", entityId: deal.client_id, newValue: { deal_id: dealId, checklist_id: data } });
  return data as string;
}

export async function setOnboardingItem(bos: BosUser, itemId: string, done: boolean) {
  const { data: item } = await db().from("onboarding_items").select("*, onboarding_checklists(id, subject, status, client_id, deal_id, project_id, employee_id)").eq("id", itemId).maybeSingle();
  if (!item) throw new NotFoundError();
  const cl = item.onboarding_checklists as unknown as { id: string; subject: string; status: string; client_id: string | null; deal_id: string | null; project_id: string | null; employee_id: string | null };
  if (cl.status === "cancelled") throw new ValidationError("قائمة التهيئة ملغاة.");
  if (item.auto_key && !done) throw new ValidationError("هذا البند يكتمل تلقائياً من النظام ولا يمكن إلغاؤه يدوياً.");
  await db().from("onboarding_items").update(done ? { is_done: true, done_by: bos.userId, done_at: nowIso() } : { is_done: false, done_by: null, done_at: null }).eq("id", itemId);
  await audit({ actorId: bos.userId, action: done ? "onboarding.item_done" : "onboarding.item_undone", entityType: cl.subject === "client" ? "client" : "employee", entityId: (cl.client_id ?? cl.employee_id) as string, newValue: { item: item.label, checklist_id: cl.id } });

  // Re-evaluate completion.
  const { data: remaining } = await db().from("onboarding_items").select("id").eq("checklist_id", cl.id).eq("required", true).eq("is_done", false);
  if (!remaining?.length && cl.status === "in_progress") {
    await db().from("onboarding_checklists").update({ status: "completed", completed_at: nowIso() }).eq("id", cl.id);
    if (cl.subject === "client" && cl.client_id) {
      await emitEvent({ type: "onboarding.completed", entityType: "client", entityId: cl.client_id, summary: "Client onboarding completed", actorId: bos.userId, payload: { checklist_id: cl.id, deal_id: cl.deal_id, project_id: cl.project_id }, links: [{ type: "deal", id: cl.deal_id }, { type: "project", id: cl.project_id }], dedupeKey: `onboarding.completed:${cl.id}` });
    }
  } else if (remaining?.length && cl.status === "completed") {
    await db().from("onboarding_checklists").update({ status: "in_progress", completed_at: null }).eq("id", cl.id);
  }
  return cl;
}

// ---------------------------------------------------------------------------
// Employee onboarding / offboarding (IT §14–16)
// ---------------------------------------------------------------------------

export const onboardingSections = ["Account Setup", "Access", "Equipment", "Knowledge", "Training", "Management", "Completion"] as const;
export const sectionLabels: Record<string, string> = {
  "Account Setup": "إعداد الحسابات",
  Access: "الصلاحيات",
  Equipment: "المعدات",
  Knowledge: "المعرفة",
  Training: "التدريب",
  Management: "الإدارة",
  Completion: "الإكمال",
  Handover: "التسليم",
  Settlement: "التسوية",
  "Hiring & Documents": "التوظيف والمستندات",
  Documents: "المستندات",
};

type ItemRow = { id: string; section: string; label: string; auto_key: string | null; responsible: string | null; required: boolean; is_done: boolean; done_by: string | null; done_at: string | null; sort_order: number; checklist_id: string; status: string; assignee_user_id: string | null; due_date: string | null; notes: string | null };

function sectionProgress(items: ItemRow[]) {
  const sections = [...new Set(items.map((i) => i.section))];
  return sections.map((s) => {
    const req = items.filter((i) => i.section === s && i.required);
    return { section: s, done: req.filter((i) => i.is_done).length, total: req.length, complete: req.every((i) => i.is_done) };
  });
}

export async function listEmployeeChecklists(employeeId: string) {
  const { data: lists } = await db().from("onboarding_checklists").select("*").eq("subject", "employee").eq("employee_id", employeeId).order("created_at", { ascending: false });
  const ids = (lists ?? []).map((l) => l.id);
  const { data: items } = ids.length ? await db().from("onboarding_items").select("*").in("checklist_id", ids).order("sort_order") : { data: [] };
  return (lists ?? []).map((l) => {
    const its = ((items ?? []) as ItemRow[]).filter((i) => i.checklist_id === l.id);
    const req = its.filter((i) => i.required);
    return { ...l, items: its, sections: sectionProgress(its), percent: req.length ? Math.round((req.filter((i) => i.is_done).length / req.length) * 100) : 100 };
  });
}

// Who may tick a confirmation item.
async function canConfirm(bos: BosUser, key: string, employee: { user_id: string | null; manager_id: string | null }) {
  const who = key.slice("confirm:".length);
  if (who === "employee") return bos.userId === employee.user_id;
  if (who === "manager") {
    if (!employee.manager_id) return bos.roleKeys.includes("hr");
    const { data: mgr } = await db().from("employees").select("user_id").eq("id", employee.manager_id).maybeSingle();
    return mgr?.user_id === bos.userId;
  }
  if (who === "admin") return bos.isSuperAdmin || bos.roleKeys.includes("admin");
  if (who === "hr") return bos.roleKeys.includes("hr") || bos.isSuperAdmin;
  if (who === "final") return bos.roleKeys.includes("hr") || bos.roleKeys.includes("admin") || bos.isSuperAdmin;
  return false;
}

// Task details for onboarding/offboarding items (docs/bos/28 §23–24):
// status, assignee, due date, notes. Status "done"/"skipped" completes the
// item (kept in sync with is_done by trigger); auto and confirmation items
// keep their own rules via setEmployeeChecklistItem.
export async function updateEmployeeChecklistItem(bos: BosUser, itemId: string, patch: { status?: string; assignee_user_id?: string | null; due_date?: string | null; notes?: string | null }, opts: { canManage: boolean }) {
  const c = db();
  const { data: item } = await c.from("onboarding_items").select("*, onboarding_checklists!inner(id, subject, status, template_key, employee_id)").eq("id", itemId).maybeSingle();
  if (!item) throw new NotFoundError();
  const cl = item.onboarding_checklists as unknown as { id: string; subject: string; status: string; template_key: string; employee_id: string };
  if (cl.subject !== "employee") throw new NotFoundError();
  if (cl.status !== "in_progress") throw new ValidationError("القائمة ليست قيد التنفيذ.");
  const isAssignee = item.assignee_user_id === bos.userId;
  if (!opts.canManage && !isAssignee) throw new ValidationError("ليس لديك صلاحية تحديث هذا البند.");
  if (!opts.canManage && (patch.assignee_user_id !== undefined || patch.due_date !== undefined)) throw new ValidationError("تعيين المسؤول وتاريخ الاستحقاق من صلاحية الموارد البشرية.");

  if (patch.status && ["done", "skipped"].includes(patch.status) !== item.is_done) {
    if (patch.status === "skipped" && item.required) throw new ValidationError("لا يمكن اعتبار بند مطلوب «لا ينطبق».");
    await setEmployeeChecklistItem(bos, itemId, ["done", "skipped"].includes(patch.status), opts);
  }
  const update: { status?: string; assignee_user_id?: string | null; due_date?: string | null; notes?: string | null } = {};
  if (patch.status && !["done", "skipped"].includes(patch.status)) update.status = patch.status;
  if (patch.status === "skipped") update.status = "skipped";
  if (patch.assignee_user_id !== undefined) update.assignee_user_id = patch.assignee_user_id;
  if (patch.due_date !== undefined) update.due_date = patch.due_date;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (Object.keys(update).length) {
    const { error } = await c.from("onboarding_items").update(update).eq("id", itemId);
    if (error) throw error;
  }
  await audit({ actorId: bos.userId, action: "onboarding.item_updated", entityType: "employee", entityId: cl.employee_id, newValue: { item: item.label, ...patch } });
  if (patch.assignee_user_id && patch.assignee_user_id !== item.assignee_user_id) {
    const { data: emp } = await c.from("employees").select("full_name").eq("id", cl.employee_id).maybeSingle();
    const offboarding = cl.template_key === "employee_offboarding";
    await emitEvent({
      type: offboarding ? "offboarding.task_assigned" : "onboarding.task_assigned",
      entityType: "employee",
      entityId: cl.employee_id,
      summary: `${offboarding ? "Offboarding" : "Onboarding"} task for ${emp?.full_name ?? ""}: ${item.label}`,
      actorId: bos.userId,
      payload: { assignee_user_id: patch.assignee_user_id, item_id: itemId, due_date: patch.due_date ?? item.due_date },
    });
  }
}

export async function setEmployeeChecklistItem(bos: BosUser, itemId: string, done: boolean, opts: { canManage: boolean }) {
  const c = db();
  const { data: item } = await c.from("onboarding_items").select("*, onboarding_checklists!inner(id, subject, status, template_key, employee_id)").eq("id", itemId).maybeSingle();
  if (!item) throw new NotFoundError();
  const cl = item.onboarding_checklists as unknown as { id: string; subject: string; status: string; template_key: string; employee_id: string };
  if (cl.subject !== "employee") throw new NotFoundError();
  if (cl.status !== "in_progress") throw new ValidationError("القائمة ليست قيد التنفيذ.");
  const { data: emp } = await c.from("employees").select("id, user_id, manager_id, full_name, lifecycle_status").eq("id", cl.employee_id).single();
  if (!emp) throw new NotFoundError();

  if (item.auto_key?.startsWith("confirm:")) {
    if (!(await canConfirm(bos, item.auto_key, emp))) throw new ValidationError("هذا التأكيد مخصص لشخص آخر.");
    if (done) {
      // Confirmations only after every other required item is done.
      const { data: open } = await c.from("onboarding_items").select("id").eq("checklist_id", cl.id).eq("required", true).eq("is_done", false).not("auto_key", "like", "confirm:%");
      if (open?.length) throw new ValidationError(`لا يمكن التأكيد قبل إكمال ${open.length} بند مطلوب.`);
    }
  } else if (item.auto_key && !item.auto_key.startsWith("read:") && !opts.canManage) {
    throw new ValidationError("هذا البند يكتمل تلقائياً من بيانات النظام.");
  } else if (item.auto_key?.startsWith("read:") && bos.userId !== emp.user_id && !opts.canManage) {
    throw new ValidationError("يكتمل هذا البند عند قراءة الموظف للمقال في قاعدة المعرفة.");
  } else if (!item.auto_key && !opts.canManage && bos.userId !== emp.user_id) {
    throw new ValidationError("ليس لديك صلاحية تحديث هذا البند.");
  }

  await c.from("onboarding_items").update(done ? { is_done: true, done_by: bos.userId, done_at: nowIso() } : { is_done: false, done_by: null, done_at: null }).eq("id", itemId);
  await audit({ actorId: bos.userId, action: done ? "onboarding.item_done" : "onboarding.item_undone", entityType: "employee", entityId: emp.id, newValue: { item: item.label, template: cl.template_key } });

  if (emp.lifecycle_status === "pending_onboarding" && cl.template_key === "employee_onboarding" && done) {
    await c.from("employees").update({ lifecycle_status: "onboarding" }).eq("id", emp.id);
    const { recordStatus } = await import("@/lib/bos/audit");
    await recordStatus("employee", emp.id, "pending_onboarding", "onboarding", bos.userId);
  }
  return completeEmployeeChecklistIfReady(bos, cl.id);
}

// All required items (incl. the three confirmations) → checklist completed;
// onboarding completion makes the employee Active (IT §14).
export async function completeEmployeeChecklistIfReady(bos: BosUser, checklistId: string) {
  const c = db();
  const { data: cl } = await c.from("onboarding_checklists").select("*").eq("id", checklistId).single();
  if (!cl || cl.status !== "in_progress") return false;
  const { data: open } = await c.from("onboarding_items").select("id").eq("checklist_id", checklistId).eq("required", true).eq("is_done", false);
  if (open?.length) return false;
  await c.from("onboarding_checklists").update({ status: "completed", completed_at: nowIso() }).eq("id", checklistId);
  const { data: emp } = await c.from("employees").select("id, user_id, full_name, lifecycle_status").eq("id", cl.employee_id as string).single();
  if (!emp) return true;
  const { recordStatus } = await import("@/lib/bos/audit");
  if (cl.template_key === "employee_onboarding" && ["pending_onboarding", "onboarding"].includes(emp.lifecycle_status)) {
    await c.from("employees").update({ lifecycle_status: "active" }).eq("id", emp.id);
    await recordStatus("employee", emp.id, emp.lifecycle_status, "active", bos.userId, "Onboarding completed");
    await audit({ actorId: bos.userId, action: "employee.lifecycle_changed", entityType: "employee", entityId: emp.id, oldValue: { lifecycle_status: emp.lifecycle_status }, newValue: { lifecycle_status: "active" }, reason: "Onboarding completed" });
    await emitEvent({ type: "onboarding.completed", entityType: "employee", entityId: emp.id, summary: `Onboarding completed: ${emp.full_name}`, actorId: bos.userId, payload: { employee_user_id: emp.user_id }, dedupeKey: `onboarding.completed:${checklistId}` });
    await emitEvent({ type: "employee.lifecycle_changed", entityType: "employee", entityId: emp.id, summary: `${emp.full_name}: ${emp.lifecycle_status} → active`, actorId: bos.userId, payload: { from: emp.lifecycle_status, to: "active", employee_user_id: emp.user_id } });
  } else if (cl.template_key === "employee_offboarding") {
    await emitEvent({ type: "offboarding.completed", entityType: "employee", entityId: emp.id, summary: `Offboarding checklist completed: ${emp.full_name}`, actorId: bos.userId, payload: { employee_user_id: emp.user_id }, dedupeKey: `offboarding.completed:${checklistId}` });
  }
  return true;
}

// Offboarding overview (docs/bos/28 §24).
export async function getOffboardingDashboard(employeeIds: string[] | null) {
  const c = db();
  let q = c.from("onboarding_checklists").select("*, employees!inner(id, full_name, position, lifecycle_status, departments(name))").eq("subject", "employee").eq("template_key", "employee_offboarding").neq("status", "cancelled").order("created_at", { ascending: false });
  if (employeeIds) q = q.in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: lists } = await q;
  const ids = (lists ?? []).map((l) => l.id);
  const empIds = (lists ?? []).map((l) => l.employee_id as string);
  const [{ data: items }, { data: seps }] = await Promise.all([
    ids.length ? c.from("onboarding_items").select("*").in("checklist_id", ids) : Promise.resolve({ data: [] as ItemRow[] }),
    empIds.length ? c.from("employee_separations").select("*").in("employee_id", empIds).neq("status", "cancelled") : Promise.resolve({ data: [] as { employee_id: string; separation_type: string; last_working_day: string | null }[] }),
  ]);
  const today = nowIso().slice(0, 10);
  return (lists ?? []).map((l) => {
    const its = ((items ?? []) as ItemRow[]).filter((i) => i.checklist_id === l.id);
    const req = its.filter((i) => i.required);
    const sep = ((seps ?? []) as { employee_id: string; separation_type: string; last_working_day: string | null }[]).find((x) => x.employee_id === l.employee_id) ?? null;
    return {
      checklistId: l.id,
      status: l.status,
      dueDate: l.due_date,
      overdue: l.status === "in_progress" && !!l.due_date && l.due_date < today,
      employee: l.employees as unknown as { id: string; full_name: string; position: string | null; lifecycle_status: string; departments: { name: string } | null },
      separation: sep,
      percent: req.length ? Math.round((req.filter((i) => i.is_done).length / req.length) * 100) : 100,
      sections: sectionProgress(its),
      openTasks: its.filter((i) => i.required && !i.is_done).length,
    };
  });
}

// Open onboarding/offboarding tasks assigned to or awaiting a person.
export async function listMyChecklistTasks(userId: string) {
  const { data } = await db().from("onboarding_items").select("id, label, section, status, due_date, onboarding_checklists!inner(id, template_key, status, employee_id, employees(id, full_name))").eq("assignee_user_id", userId).eq("is_done", false).eq("onboarding_checklists.status", "in_progress").order("due_date", { nullsFirst: false }).limit(50);
  return data ?? [];
}

export async function getOnboardingDashboard(employeeIds: string[] | null) {
  const c = db();
  let q = c.from("onboarding_checklists").select("*, employees!inner(id, full_name, position, start_date, lifecycle_status, manager_id, created_at, departments(name))").eq("subject", "employee").eq("template_key", "employee_onboarding").neq("status", "cancelled").order("created_at", { ascending: false });
  if (employeeIds) q = q.in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: lists } = await q;
  const ids = (lists ?? []).map((l) => l.id);
  const empIds = (lists ?? []).map((l) => l.employee_id as string);
  const [{ data: items }, { data: grants }] = await Promise.all([
    ids.length ? c.from("onboarding_items").select("*").in("checklist_id", ids) : Promise.resolve({ data: [] as ItemRow[] }),
    empIds.length ? c.from("access_grants").select("employee_id, status, is_required").in("employee_id", empIds) : Promise.resolve({ data: [] as { employee_id: string; status: string; is_required: boolean }[] }),
  ]);
  const today = nowIso().slice(0, 10);
  const since = new Date(nowMs() - 30 * 86400_000).toISOString();
  const rows = (lists ?? []).map((l) => {
    const its = ((items ?? []) as ItemRow[]).filter((i) => i.checklist_id === l.id);
    const req = its.filter((i) => i.required);
    const emp = l.employees as unknown as { id: string; full_name: string; position: string | null; start_date: string | null; lifecycle_status: string; manager_id: string | null; created_at: string; departments: { name: string } | null };
    const missingAccess = ((grants ?? []) as { employee_id: string; status: string; is_required: boolean }[]).filter((g) => g.employee_id === emp.id && g.is_required && g.status !== "active").length;
    const pendingOf = (section: string) => its.filter((i) => i.section === section && i.required && !i.is_done).length;
    return {
      checklistId: l.id,
      status: l.status,
      dueDate: l.due_date,
      overdue: l.status === "in_progress" && !!l.due_date && l.due_date < today,
      employee: emp,
      percent: req.length ? Math.round((req.filter((i) => i.is_done).length / req.length) * 100) : 100,
      sections: sectionProgress(its),
      missingAccess,
      missingDocuments: pendingOf("Knowledge"),
      missingTraining: pendingOf("Training"),
      pendingManager: pendingOf("Management") + its.filter((i) => i.auto_key === "confirm:manager" && !i.is_done).length,
      isNew: emp.created_at >= since,
    };
  });
  const inProgress = rows.filter((r) => r.status === "in_progress");
  return {
    rows,
    cards: {
      newEmployees: rows.filter((r) => r.isNew).length,
      inProgress: inProgress.length,
      completed: rows.filter((r) => r.status === "completed").length,
      overdue: rows.filter((r) => r.overdue).length,
      missingAccess: inProgress.filter((r) => r.missingAccess > 0).length,
      missingDocuments: inProgress.filter((r) => r.missingDocuments > 0).length,
      missingTraining: inProgress.filter((r) => r.missingTraining > 0).length,
      pendingManager: inProgress.filter((r) => r.pendingManager > 0).length,
    },
  };
}
