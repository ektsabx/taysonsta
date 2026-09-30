import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db, dec } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { allocateByPercent, parseMoney, toDecimalString, decimalsFor } from "@/lib/bos/money";
import { requestApproval } from "@/services/bos/approvals";
import { approvalSteps } from "@/services/bos/hr/policy";
import { monthAfter, settleLoanIfDone } from "@/services/bos/hr/payroll";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";

// Employee requests (docs/bos/28 §17–19, §26): bonuses, loans / salary
// advances with installments, expense claims (on the Finance expense row)
// and other HR requests. All approvals go through the generic engine.

async function employee(employeeId: string) {
  const { data } = await db().from("employees").select("id, user_id, full_name, lifecycle_status").eq("id", employeeId).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

// ---------------------------------------------------------------------------
// Bonuses
// ---------------------------------------------------------------------------

export interface BonusInput {
  employee_id: string;
  bonus_type: "one_time" | "performance" | "sales" | "annual" | "custom";
  title: string;
  amount: string;
  currency: string;
  reason: string;
  pay_period: string; // YYYY-MM
}

export async function requestBonus(bos: BosUser, input: BonusInput) {
  const emp = await employee(input.employee_id);
  if (["terminated", "archived"].includes(emp.lifecycle_status)) throw new ValidationError("الموظف منتهي الخدمة.");
  if (!(parseMoney(input.amount) ?? BigInt(0))) throw new ValidationError("المبلغ مطلوب.", { amount: "مطلوب" });
  const { data, error } = await db()
    .from("employee_bonuses")
    .insert({ employee_id: emp.id, user_id: emp.user_id, bonus_type: input.bonus_type, title: input.title, amount: dec(input.amount) as unknown as number, currency: input.currency, reason: input.reason, pay_period: `${input.pay_period}-01`, requested_by: bos.userId })
    .select("*")
    .single();
  if (error) throw error;
  await recordStatus("employee_bonus", data.id, null, "pending", bos.userId);
  await audit({ actorId: bos.userId, action: "bonus.requested", entityType: "employee", entityId: emp.id, newValue: { bonus_id: data.id, ...input } });
  const steps = await approvalSteps("bonus", ["role:finance"]);
  await requestApproval({ type: "bonus", entityType: "employee_bonus", entityId: data.id, title: `${emp.full_name} — ${input.title} (${input.amount} ${input.currency})`, requestedBy: bos.userId, steps, links: [{ type: "employee", id: emp.id }] });
  return data;
}

export async function applyBonusDecision(id: string, decision: "approved" | "rejected", actorId: string | null, comment: string | null) {
  const { data: b } = await db().from("employee_bonuses").select("*").eq("id", id).maybeSingle();
  if (!b || b.status !== "pending") return;
  await db().from("employee_bonuses").update({ status: decision, decided_by: actorId, decided_at: nowIso(), decision_comment: comment }).eq("id", id);
  await recordStatus("employee_bonus", id, "pending", decision, actorId, comment);
  await audit({ actorId, action: `bonus.${decision}`, entityType: "employee", entityId: b.employee_id, newValue: { bonus_id: id }, reason: comment });
  await emitEvent({ type: "bonus.decided", entityType: "employee", entityId: b.employee_id, summary: `Bonus ${decision}: ${b.title} (${b.amount} ${b.currency})`, actorId, payload: { employee_user_id: b.user_id, creator_user_id: b.requested_by, decision } });
}

export async function cancelBonus(bos: BosUser, id: string, reason: string) {
  const { data: b } = await db().from("employee_bonuses").select("*").eq("id", id).maybeSingle();
  if (!b) throw new NotFoundError();
  if (!["pending", "approved"].includes(b.status) || b.payslip_id) throw new ValidationError("لا يمكن إلغاء مكافأة مدرجة في رواتب.");
  await db().from("employee_bonuses").update({ status: "cancelled", decision_comment: reason }).eq("id", id);
  await db().from("approvals").update({ status: "cancelled", decided_at: nowIso() }).eq("entity_type", "employee_bonus").eq("entity_id", id).eq("status", "pending");
  await recordStatus("employee_bonus", id, b.status, "cancelled", bos.userId, reason);
  await audit({ actorId: bos.userId, action: "bonus.cancelled", entityType: "employee", entityId: b.employee_id, reason });
}

export async function listBonuses(f: { employeeIds?: string[] | null; employee?: string; status?: string; userId?: string }) {
  let q = db().from("employee_bonuses").select("*, employees(id, user_id, full_name, photo_updated_at)").order("created_at", { ascending: false }).limit(300);
  if (f.employeeIds) q = q.in("employee_id", f.employeeIds.length ? f.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.status) q = q.eq("status", f.status);
  const { data } = await q;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Loans and salary advances
// ---------------------------------------------------------------------------

export interface LoanInput {
  employee_id: string;
  loan_type: "advance" | "loan";
  amount: string;
  currency: string;
  installments: number;
  start_period: string; // YYYY-MM
  reason: string;
}

// Equal installments; the last one absorbs rounding so the sum is exact
// (30,000 / 10 → 3,000 × 10).
export function buildInstallments(amount: string, count: number, currency: string, startPeriod: string) {
  const share = Array.from({ length: count }, () => 100 / count);
  const parts = allocateByPercent(amount, share, currency);
  return parts.map((units, i) => ({ seq: i + 1, due_period: monthAfter(`${startPeriod}-01`, i), amount: toDecimalString(units, decimalsFor(currency)) }));
}

export async function requestLoan(bos: BosUser, input: LoanInput) {
  const emp = await employee(input.employee_id);
  if (!["active", "on_leave", "onboarding"].includes(emp.lifecycle_status)) throw new ValidationError("السلف والقروض متاحة للموظفين النشطين فقط.");
  if (!(parseMoney(input.amount) ?? BigInt(0))) throw new ValidationError("المبلغ مطلوب.", { amount: "مطلوب" });
  if (input.loan_type === "advance" && input.installments > 3) throw new ValidationError("السلفة تُسدد خلال 3 أشهر كحد أقصى؛ استخدم «قرض» لمدة أطول.", { installments: "الحد 3" });
  const { count: open } = await db().from("employee_loans").select("id", { count: "exact", head: true }).eq("employee_id", emp.id).in("status", ["pending", "approved"]);
  if (open) throw new ValidationError("يوجد طلب سلفة/قرض قيد المراجعة لهذا الموظف.");
  const plan = buildInstallments(input.amount, input.installments, input.currency, input.start_period);
  const { data: number } = await db().rpc("bos_next_number", { seq_key: "employee_loan" });
  const { data, error } = await db()
    .from("employee_loans")
    .insert({ loan_number: number as string, employee_id: emp.id, user_id: emp.user_id, loan_type: input.loan_type, amount: dec(input.amount) as unknown as number, currency: input.currency, installments: input.installments, installment_amount: Number(plan[0].amount), start_period: `${input.start_period}-01`, reason: input.reason, requested_by: bos.userId })
    .select("*")
    .single();
  if (error) throw error;
  await db().from("loan_installments").insert(plan.map((p) => ({ loan_id: data.id, seq: p.seq, due_period: p.due_period, amount: Number(p.amount) })));
  await recordStatus("employee_loan", data.id, null, "pending", bos.userId);
  await audit({ actorId: bos.userId, action: "loan.requested", entityType: "employee", entityId: emp.id, newValue: { loan_id: data.id, ...input } });
  const steps = await approvalSteps(input.loan_type === "advance" ? "advance" : "loan", input.loan_type === "advance" ? ["manager", "role:finance"] : ["manager", "role:hr", "role:finance"]);
  // Requested on behalf of the employee so "manager" resolves to their manager.
  await requestApproval({ type: "loan", entityType: "employee_loan", entityId: data.id, title: `${emp.full_name} — ${input.loan_type === "advance" ? "سلفة" : "قرض"} ${input.amount} ${input.currency} / ${input.installments} قسط`, requestedBy: emp.user_id ?? bos.userId, steps, links: [{ type: "employee", id: emp.id }] });
  return data;
}

export async function applyLoanDecision(id: string, decision: "approved" | "rejected", actorId: string | null, comment: string | null) {
  const { data: l } = await db().from("employee_loans").select("*").eq("id", id).maybeSingle();
  if (!l || l.status !== "pending") return;
  await db().from("employee_loans").update({ status: decision, decided_by: actorId, decided_at: nowIso(), decision_comment: comment }).eq("id", id);
  await recordStatus("employee_loan", id, "pending", decision, actorId, comment);
  await audit({ actorId, action: `loan.${decision}`, entityType: "employee", entityId: l.employee_id, newValue: { loan_id: id }, reason: comment });
  await emitEvent({ type: "loan.decided", entityType: "employee", entityId: l.employee_id, summary: `${l.loan_type === "advance" ? "Salary advance" : "Loan"} ${decision}: ${l.amount} ${l.currency}`, actorId, payload: { employee_user_id: l.user_id, decision } });
}

// Finance records the payout; installments then deduct in payroll.
export async function disburseLoan(bos: BosUser, id: string, reference: string | null) {
  const { data: l } = await db().from("employee_loans").select("*").eq("id", id).maybeSingle();
  if (!l) throw new NotFoundError();
  if (l.status !== "approved") throw new ValidationError("الصرف بعد الاعتماد فقط.");
  await db().from("employee_loans").update({ status: "active", disbursed_at: nowIso(), disbursement_reference: reference }).eq("id", id);
  await recordStatus("employee_loan", id, "approved", "active", bos.userId, reference);
  await audit({ actorId: bos.userId, action: "loan.disbursed", entityType: "employee", entityId: l.employee_id, newValue: { loan_id: id, reference } });
}

export async function settleInstallmentManually(bos: BosUser, installmentId: string, mode: "paid_manually" | "waived" | "skipped", note: string) {
  const { data: i } = await db().from("loan_installments").select("*, employee_loans(id, employee_id, status, currency)").eq("id", installmentId).maybeSingle();
  if (!i) throw new NotFoundError();
  if (i.status !== "scheduled") throw new ValidationError("القسط ليس مجدولاً.");
  if (!note) throw new ValidationError("الملاحظة مطلوبة.", { note: "مطلوب" });
  const loan = i.employee_loans as unknown as { id: string; employee_id: string; status: string; currency: string };
  if (mode === "skipped") {
    // Postpone: move this and every later installment one month.
    const { data: rest } = await db().from("loan_installments").select("id, due_period").eq("loan_id", loan.id).eq("status", "scheduled").gte("seq", i.seq);
    for (const r of rest ?? []) await db().from("loan_installments").update({ due_period: monthAfter(r.due_period, 1) }).eq("id", r.id);
    await db().from("loan_installments").update({ note }).eq("id", installmentId);
  } else {
    await db().from("loan_installments").update({ status: mode, settled_at: nowIso(), note }).eq("id", installmentId);
    await settleLoanIfDone(loan.id);
  }
  await audit({ actorId: bos.userId, action: `loan.installment_${mode}`, entityType: "employee", entityId: loan.employee_id, newValue: { installment_id: installmentId, seq: i.seq }, reason: note });
  await refreshEmployeeOnboardingSafe(loan.employee_id, bos.userId);
}

export async function cancelLoan(bos: BosUser, id: string, reason: string) {
  const { data: l } = await db().from("employee_loans").select("*").eq("id", id).maybeSingle();
  if (!l) throw new NotFoundError();
  if (!["pending", "approved"].includes(l.status)) throw new ValidationError("لا يمكن إلغاء قرض تم صرفه؛ سوِّ الأقساط بدلاً من ذلك.");
  await db().from("employee_loans").update({ status: "cancelled", decision_comment: reason }).eq("id", id);
  await db().from("approvals").update({ status: "cancelled", decided_at: nowIso() }).eq("entity_type", "employee_loan").eq("entity_id", id).eq("status", "pending");
  await recordStatus("employee_loan", id, l.status, "cancelled", bos.userId, reason);
  await audit({ actorId: bos.userId, action: "loan.cancelled", entityType: "employee", entityId: l.employee_id, reason });
}

export async function listLoans(f: { employeeIds?: string[] | null; employee?: string; status?: string; userId?: string }) {
  let q = db().from("employee_loans").select("*, employees(id, user_id, full_name, photo_updated_at), loan_installments(id, seq, due_period, amount, status, payslip_id, settled_at, note)").order("created_at", { ascending: false }).limit(300);
  if (f.employeeIds) q = q.in("employee_id", f.employeeIds.length ? f.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.status) q = q.eq("status", f.status);
  const { data } = await q;
  return (data ?? []).map((l) => {
    const inst = ((l.loan_installments as { amount: number; status: string; seq: number }[]) ?? []).sort((a, b) => a.seq - b.seq);
    const paid = inst.filter((x) => ["deducted", "paid_manually", "waived"].includes(x.status)).reduce((s, x) => s + Number(x.amount), 0);
    return { ...l, installmentsList: inst, paid, remaining: Math.max(0, Number(l.amount) - paid) };
  });
}

// ---------------------------------------------------------------------------
// Employee expense claims → Finance expenses (manager → finance approval)
// ---------------------------------------------------------------------------

export interface ExpenseClaimInput {
  employee_id: string;
  category_id: string;
  description: string;
  amount: string;
  currency: string;
  expense_date: string;
  expense_kind: string | null;
  project_id: string | null;
  client_id: string | null;
}

export async function submitExpenseClaim(bos: BosUser, input: ExpenseClaimInput) {
  const emp = await employee(input.employee_id);
  if (!emp.user_id) throw new ValidationError("الموظف ليس لديه حساب في النظام.");
  if (!(parseMoney(input.amount) ?? BigInt(0))) throw new ValidationError("المبلغ مطلوب.", { amount: "مطلوب" });
  const { data, error } = await db()
    .from("expenses")
    .insert({ category_id: input.category_id, description: input.description, amount: dec(input.amount) as unknown as number, currency: input.currency, expense_date: input.expense_date, project_id: input.project_id, client_id: input.client_id, employee_user_id: emp.user_id, reimbursable: true, reimbursement_status: "not_applicable", expense_kind: input.expense_kind, approval_status: "pending", created_by: bos.userId, source_type: "employee_claim" })
    .select("*")
    .single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "expense.claim_submitted", entityType: "expense", entityId: data.id, newValue: { amount: input.amount, currency: input.currency, description: input.description, employee_id: emp.id } });
  const steps = await approvalSteps("employee_expense", ["manager", "role:finance"]);
  await requestApproval({ type: "expense", entityType: "expense", entityId: data.id, title: `${emp.full_name} — مصروف: ${input.description} (${input.amount} ${input.currency})`, requestedBy: emp.user_id, steps, links: [{ type: "employee", id: emp.id }, { type: "project", id: input.project_id }] });
  return data;
}

export async function listExpenseClaims(f: { userIds?: string[] | null; userId?: string; status?: string; reimbursement?: string }) {
  let q = db().from("expenses").select("*, expense_categories(name), projects(id, name)").eq("reimbursable", true).is("archived_at", null).order("expense_date", { ascending: false }).limit(300);
  if (f.userIds) q = q.in("employee_user_id", f.userIds.length ? f.userIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.userId) q = q.eq("employee_user_id", f.userId);
  if (f.status) q = q.eq("approval_status", f.status);
  if (f.reimbursement) q = q.eq("reimbursement_status", f.reimbursement as "pending");
  const { data } = await q;
  return data ?? [];
}

export async function reimburseDirectly(bos: BosUser, expenseId: string, reference: string | null) {
  const { data: e } = await db().from("expenses").select("*").eq("id", expenseId).maybeSingle();
  if (!e) throw new NotFoundError();
  if (!e.reimbursable || e.reimbursement_status !== "pending") throw new ValidationError("المصروف ليس بانتظار الاسترداد.");
  await db().from("expenses").update({ reimbursement_status: "reimbursed", reimbursement_method: "direct", reimbursed_at: nowIso(), reimbursement_reference: reference }).eq("id", expenseId);
  await audit({ actorId: bos.userId, action: "expense.reimbursed", entityType: "expense", entityId: expenseId, newValue: { method: "direct", reference } });
  await emitEvent({ type: "employee_expense.reimbursed", entityType: "employee_expense", entityId: expenseId, summary: `Expense reimbursed: ${e.description} (${e.amount} ${e.currency})`, actorId: bos.userId, payload: { employee_user_id: e.employee_user_id } });
  const { data: emp } = e.employee_user_id ? await db().from("employees").select("id").eq("user_id", e.employee_user_id).maybeSingle() : { data: null };
  if (emp) await refreshEmployeeOnboardingSafe(emp.id, bos.userId);
}

// ---------------------------------------------------------------------------
// Other HR requests
// ---------------------------------------------------------------------------

export async function listRequestTypes(activeOnly = true) {
  let q = db().from("hr_request_types").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}

export async function submitHrRequest(bos: BosUser, input: { employee_id: string; type_id: string; subject: string; details: string | null; due_date: string | null }) {
  const emp = await employee(input.employee_id);
  const { data: type } = await db().from("hr_request_types").select("*").eq("id", input.type_id).maybeSingle();
  if (!type || !type.is_active) throw new ValidationError("نوع الطلب غير متاح.", { type_id: "غير متاح" });
  const { data: number } = await db().rpc("bos_next_number", { seq_key: "hr_request" });
  const { data, error } = await db().from("hr_requests").insert({ request_number: number as string, employee_id: emp.id, user_id: emp.user_id, type_id: type.id, subject: input.subject, details: input.details, due_date: input.due_date, created_by: bos.userId }).select("*").single();
  if (error) throw error;
  await recordStatus("hr_request", data.id, null, "pending", bos.userId);
  await audit({ actorId: bos.userId, action: "hr_request.submitted", entityType: "employee", entityId: emp.id, newValue: { request_id: data.id, type: type.key, subject: input.subject } });
  await requestApproval({ type: "hr_request", entityType: "hr_request", entityId: data.id, title: `${emp.full_name} — ${type.name}: ${input.subject}`, requestedBy: emp.user_id ?? bos.userId, steps: type.approval_steps.length ? type.approval_steps : ["manager"], links: [{ type: "employee", id: emp.id }] });
  return data;
}

export async function applyHrRequestDecision(id: string, decision: "approved" | "rejected", actorId: string | null, comment: string | null) {
  const { data: r } = await db().from("hr_requests").select("*").eq("id", id).maybeSingle();
  if (!r || r.status !== "pending") return;
  await db().from("hr_requests").update({ status: decision, response: comment, handled_by: actorId }).eq("id", id);
  await recordStatus("hr_request", id, "pending", decision, actorId, comment);
  await audit({ actorId, action: `hr_request.${decision}`, entityType: "employee", entityId: r.employee_id, newValue: { request_id: id }, reason: comment });
  await emitEvent({ type: "hr_request.decided", entityType: "employee", entityId: r.employee_id, summary: `HR request ${decision}: ${r.subject}`, actorId, payload: { employee_user_id: r.user_id, decision } });
}

export async function progressHrRequest(bos: BosUser, id: string, to: "in_progress" | "completed" | "cancelled", response: string | null) {
  const { data: r } = await db().from("hr_requests").select("*").eq("id", id).maybeSingle();
  if (!r) throw new NotFoundError();
  const allowed: Record<string, string[]> = { pending: ["cancelled"], approved: ["in_progress", "completed", "cancelled"], in_progress: ["completed", "cancelled"] };
  if (!(allowed[r.status] ?? []).includes(to)) throw new ValidationError("لا يمكن نقل الطلب لهذه الحالة.");
  await db().from("hr_requests").update({ status: to, response: response ?? r.response, handled_by: bos.userId, completed_at: to === "completed" ? nowIso() : null }).eq("id", id);
  if (to === "cancelled") await db().from("approvals").update({ status: "cancelled", decided_at: nowIso() }).eq("entity_type", "hr_request").eq("entity_id", id).eq("status", "pending");
  await recordStatus("hr_request", id, r.status, to, bos.userId, response);
  await audit({ actorId: bos.userId, action: `hr_request.${to}`, entityType: "employee", entityId: r.employee_id, newValue: { request_id: id }, reason: response });
  if (to === "completed") await emitEvent({ type: "hr_request.completed", entityType: "employee", entityId: r.employee_id, summary: `HR request completed: ${r.subject}`, actorId: bos.userId, payload: { employee_user_id: r.user_id } });
}

export async function listHrRequests(f: { employeeIds?: string[] | null; userId?: string; status?: string; type?: string; employee?: string }) {
  let q = db().from("hr_requests").select("*, hr_request_types(name, key), employees(id, user_id, full_name, photo_updated_at)").order("created_at", { ascending: false }).limit(300);
  if (f.employeeIds) q = q.in("employee_id", f.employeeIds.length ? f.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.status) q = q.eq("status", f.status);
  if (f.type) q = q.eq("type_id", f.type);
  const { data } = await q;
  return data ?? [];
}
