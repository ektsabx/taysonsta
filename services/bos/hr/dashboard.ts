import "server-only";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { addDays, startOfMonth } from "@/lib/bos/format";
import { getToday } from "@/services/bos/attendance";

// HR Overview (docs/bos/28 §27): today's attendance, working hours,
// pending requests and alerts — all from live data in the viewer's scope.

export interface HrOverviewScope {
  userIds: string[] | null; // null = everyone
  employeeIds: string[] | null;
  canPayroll: boolean;
  canDocuments: boolean;
  canRecruitment: boolean;
}

export async function getHrOverview(bos: BosUser, scope: HrOverviewScope, today: string) {
  const c = db();
  const inUsers = <T extends { in: (col: string, vals: string[]) => T }>(q: T, col: string) => (scope.userIds ? q.in(col, scope.userIds.length ? scope.userIds : ["00000000-0000-0000-0000-000000000000"]) : q);
  const inEmps = <T extends { in: (col: string, vals: string[]) => T }>(q: T, col: string) => (scope.employeeIds ? q.in(col, scope.employeeIds.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]) : q);

  // Today: statuses already resolve leave / holiday / day off for people without a record.
  const todayRows = await getToday(scope.userIds, {});
  const count = (pred: (s: string) => boolean) => todayRows.filter((r) => pred(r.status)).length;
  const today_ = {
    employees: todayRows.length,
    present: count((s) => ["present", "remote", "overtime", "on_break", "half_day", "late"].includes(s)),
    late: count((s) => s === "late"),
    absent: count((s) => s === "absent"),
    onLeave: count((s) => s === "leave"),
    dayOff: count((s) => s === "day_off" || s === "holiday"),
    notSignedIn: count((s) => s === "not_clocked_in"),
  };
  const lateList = todayRows.filter((r) => r.status === "late").map((r) => ({ employee: r.employee, lateMinutes: r.record?.late_minutes ?? 0, firstIn: r.record?.first_clock_in ?? null }));

  // Working hours: today and month to date.
  const monthStart = startOfMonth(today);
  const { data: monthRecs } = await inUsers(c.from("attendance_records").select("work_date, expected_minutes, worked_minutes, overtime_minutes").gte("work_date", monthStart).lte("work_date", today), "user_id");
  const sum = (rows: { expected_minutes: number; worked_minutes: number; overtime_minutes: number }[]) => ({ expected: rows.reduce((s, r) => s + r.expected_minutes, 0), worked: rows.reduce((s, r) => s + r.worked_minutes, 0), overtime: rows.reduce((s, r) => s + r.overtime_minutes, 0) });
  const hours = { today: sum(todayRows.map((r) => r.record).filter(Boolean) as { expected_minutes: number; worked_minutes: number; overtime_minutes: number }[]), month: sum(monthRecs ?? []) };

  // Pending requests.
  const pendingCount = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [leave, overtime, corrections, expenses, loans, bonuses, other, myApprovals] = await Promise.all([
    pendingCount(inUsers(c.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"), "user_id")),
    pendingCount(inUsers(c.from("overtime_requests").select("id", { count: "exact", head: true }).eq("status", "pending"), "user_id")),
    pendingCount(inUsers(c.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending"), "user_id")),
    pendingCount(inUsers(c.from("expenses").select("id", { count: "exact", head: true }).eq("reimbursable", true).eq("approval_status", "pending").is("archived_at", null), "employee_user_id")),
    pendingCount(inEmps(c.from("employee_loans").select("id", { count: "exact", head: true }).eq("status", "pending"), "employee_id")),
    pendingCount(inEmps(c.from("employee_bonuses").select("id", { count: "exact", head: true }).eq("status", "pending"), "employee_id")),
    pendingCount(inEmps(c.from("hr_requests").select("id", { count: "exact", head: true }).eq("status", "pending"), "employee_id")),
    myPendingApprovals(bos),
  ]);

  // Alerts.
  const soon = addDays(today, 30);
  const [contracts, documents, onboarding, offboarding, probation, payrollRuns, recruiting] = await Promise.all([
    scope.canDocuments ? inEmps(c.from("employee_contracts").select("id, contract_number, end_date, employee_id, employees(full_name)").eq("status", "active").not("end_date", "is", null).lte("end_date", soon).order("end_date"), "employee_id").then((r) => r.data ?? []) : Promise.resolve([]),
    scope.canDocuments ? inEmps(c.from("employee_documents").select("id, title, expiry_date, status, employee_id, employees(full_name), document_types(name, alert_days_before)").in("status", ["valid", "pending_verification", "expired"]).not("expiry_date", "is", null).lte("expiry_date", soon).order("expiry_date"), "employee_id").then((r) => r.data ?? []) : Promise.resolve([]),
    inEmps(c.from("onboarding_checklists").select("id, due_date, employee_id, employees(full_name)").eq("template_key", "employee_onboarding").eq("status", "in_progress"), "employee_id").then((r) => r.data ?? []),
    inEmps(c.from("onboarding_checklists").select("id, due_date, employee_id, employees(full_name)").eq("template_key", "employee_offboarding").eq("status", "in_progress"), "employee_id").then((r) => r.data ?? []),
    inEmps(c.from("employees").select("id, full_name, probation_end_date").eq("probation_status", "in_probation").lte("probation_end_date", addDays(today, 14)).order("probation_end_date"), "id").then((r) => r.data ?? []),
    scope.canPayroll ? c.from("payroll_runs").select("id, run_number, period_start, status").in("status", ["draft", "calculated", "pending_approval", "approved"]).order("period_start", { ascending: false }).then((r) => r.data ?? []) : Promise.resolve([]),
    scope.canRecruitment ? c.from("career_applications").select("id", { count: "exact", head: true }).eq("status", "new").then((r) => r.count ?? 0) : Promise.resolve(0),
  ]);
  const checklistIds = [...onboarding, ...offboarding].map((x) => x.id);
  const { data: openItems } = checklistIds.length ? await c.from("onboarding_items").select("checklist_id, due_date").in("checklist_id", checklistIds).eq("is_done", false).eq("required", true) : { data: [] };
  const openTasks = (id: string) => (openItems ?? []).filter((i) => i.checklist_id === id).length;
  const overdueTasks = (openItems ?? []).filter((i) => i.due_date && i.due_date < today).length;

  return {
    today: today_,
    lateList,
    hours,
    requests: { leave, overtime, corrections, expenses, loans, bonuses, other, myApprovals },
    alerts: {
      contracts,
      documents,
      onboarding: onboarding.map((o) => ({ ...o, open: openTasks(o.id), overdue: !!o.due_date && o.due_date < today })),
      offboarding: offboarding.map((o) => ({ ...o, open: openTasks(o.id), overdue: !!o.due_date && o.due_date < today })),
      overdueChecklistTasks: overdueTasks,
      probation,
      payrollRuns,
      newApplications: recruiting,
    },
  };
}

async function myPendingApprovals(bos: BosUser) {
  const { data: roles } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
  const roleIds = (roles ?? []).map((r) => r.role_id);
  const hrTypes = ["leave", "expense", "attendance_correction", "overtime", "payroll", "loan", "bonus", "hr_request", "job_offer", "salary_adjustment"] as const;
  const { count } = await db()
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .in("approval_type", [...hrTypes])
    .or([`approver_user_id.eq.${bos.userId}`, ...(roleIds.length ? [`approver_role_id.in.(${roleIds.join(",")})`] : [])].join(","));
  return count ?? 0;
}
