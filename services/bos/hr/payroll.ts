import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { addMoney, parseMoney, toDecimalString, decimalsFor } from "@/lib/bos/money";
import { calculatePayslip, type ComponentInput, type PayrollInput } from "@/lib/bos/payroll-calc";
import { requestApproval } from "@/services/bos/approvals";
import { approvalSteps, payrollPolicy } from "@/services/bos/hr/policy";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";

// Payroll (docs/bos/28 §16–18, §32): run → calculate → submit (Finance
// approval) → publish payslips → mark paid (posts salary cost to the Finance
// expenses ledger and settles overtime, bonuses, commissions, loan
// installments and reimbursements). Every input is snapshotted as a line.

export type PayrollRun = Tables<"payroll_runs">;
export type Payslip = Tables<"payslips">;

export function periodBounds(month: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ValidationError("الفترة غير صالحة (YYYY-MM).", { period: "غير صالحة" });
  const start = `${month}-01`;
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { start, end: d.toISOString().slice(0, 10) };
}

export async function listRuns(f: { status?: string; year?: string; type?: string } = {}) {
  let q = db().from("payroll_runs").select("*, departments(name), employees(id, full_name)").order("period_start", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (f.status) q = q.eq("status", f.status);
  if (f.type) q = q.eq("run_type", f.type);
  if (f.year) q = q.gte("period_start", `${f.year}-01-01`).lte("period_start", `${f.year}-12-31`);
  const { data } = await q;
  return data ?? [];
}

export async function getRun(id: string) {
  const { data: run } = await db().from("payroll_runs").select("*, departments(name), employees(id, full_name)").eq("id", id).maybeSingle();
  if (!run) throw new NotFoundError();
  const { data: slips } = await db().from("payslips").select("*, employees(id, user_id, full_name, employee_code, position, photo_updated_at, departments(name))").eq("run_id", id).order("created_at");
  return { run, payslips: slips ?? [] };
}

export interface RunInput {
  run_type: "regular" | "off_cycle" | "final_settlement";
  period: string;
  pay_date: string | null;
  department_id: string | null;
  employee_id: string | null;
  notes: string | null;
}

export async function createRun(bos: BosUser, input: RunInput) {
  const { start, end } = periodBounds(input.period);
  if (input.run_type === "final_settlement" && !input.employee_id) throw new ValidationError("التسوية النهائية لموظف محدد.", { employee_id: "مطلوب" });
  if (input.run_type === "off_cycle" && !input.employee_id && !input.department_id) throw new ValidationError("حدد الموظف أو القسم لدورة خارج الجدول.", { employee_id: "مطلوب" });
  const { data: number } = await db().rpc("bos_next_number", { seq_key: "payroll_run" });
  const { data, error } = await db()
    .from("payroll_runs")
    .insert({ run_number: number as string, run_type: input.run_type, period_start: start, period_end: end, pay_date: input.pay_date, department_id: input.department_id, employee_id: input.employee_id, notes: input.notes, created_by: bos.userId })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new ValidationError("توجد دورة رواتب لنفس الشهر (ونفس القسم) بالفعل.", { period: "مكرر" });
    throw error;
  }
  await recordStatus("payroll_run", data.id, null, "draft", bos.userId);
  await audit({ actorId: bos.userId, action: "payroll.run_created", entityType: "payroll_run", entityId: data.id, newValue: { ...input, start, end } });
  return data;
}

type Emp = { id: string; user_id: string | null; full_name: string; start_date: string | null; lifecycle_status: string; department_id: string | null };

async function eligibleEmployees(run: PayrollRun): Promise<Emp[]> {
  let q = db().from("employees").select("id, user_id, full_name, start_date, lifecycle_status, department_id").not("lifecycle_status", "in", "(candidate,hired)");
  if (run.employee_id) q = q.eq("id", run.employee_id);
  else if (run.department_id) q = q.eq("department_id", run.department_id);
  const { data } = await q;
  const emps = (data ?? []) as Emp[];
  const { data: seps } = await db().from("employee_separations").select("employee_id, last_working_day, status").in("employee_id", emps.map((e) => e.id).length ? emps.map((e) => e.id) : ["00000000-0000-0000-0000-000000000000"]).neq("status", "cancelled");
  const lastDay = new Map((seps ?? []).map((s) => [s.employee_id, s.last_working_day]));
  return emps.filter((e) => {
    if (e.start_date && e.start_date > run.period_end) return false;
    const last = lastDay.get(e.id);
    if (last && last < run.period_start) return false;
    if (["terminated", "archived"].includes(e.lifecycle_status) && !last) return run.run_type === "final_settlement";
    return true;
  });
}

async function buildInput(run: PayrollRun, emp: Emp, policy: Awaited<ReturnType<typeof payrollPolicy>>, manual: PayrollInput["manual"]) {
  const c = db();
  const { data: comp } = await c.from("employee_compensation").select("*").eq("employee_id", emp.id).eq("approval_status", "approved").lte("effective_from", run.period_end).order("effective_from", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!comp) return null;
  const currency = comp.currency;
  const { data: sep } = await c.from("employee_separations").select("last_working_day").eq("employee_id", emp.id).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const from = emp.start_date && emp.start_date > run.period_start ? emp.start_date : run.period_start;
  const to = sep?.last_working_day && sep.last_working_day < run.period_end ? sep.last_working_day : run.period_end;
  const monthStart = run.period_start;

  const [periodDays, employedDays, components, records, unpaid, overtime, bonuses, commissions, reimbursements, installments] = await Promise.all([
    c.rpc("bos_employee_work_days", { p_employee: emp.id, p_from: run.period_start, p_to: run.period_end }),
    c.rpc("bos_employee_work_days", { p_employee: emp.id, p_from: from, p_to: to }),
    c.from("employee_salary_components").select("id, amount, effective_from, effective_to, salary_components(key, name, kind, category, calc_type, taxable, is_active)").eq("employee_id", emp.id).lte("effective_from", run.period_end).or(`effective_to.is.null,effective_to.gte.${run.period_start}`),
    emp.user_id ? c.from("attendance_records").select("status, late_minutes, overtime_minutes").eq("user_id", emp.user_id).gte("work_date", from).lte("work_date", to) : Promise.resolve({ data: [] as { status: string; late_minutes: number; overtime_minutes: number }[] }),
    emp.user_id ? c.from("leave_requests").select("start_date, end_date, half_day, leave_types!inner(is_paid)").eq("user_id", emp.user_id).eq("status", "approved").eq("leave_types.is_paid", false).lte("start_date", to).gte("end_date", from) : Promise.resolve({ data: [] as { start_date: string; end_date: string; half_day: boolean }[] }),
    emp.user_id && policy.overtime.source === "approved_requests" ? c.from("overtime_requests").select("id, work_date, minutes, approved_minutes, rate_multiplier, day_type").eq("user_id", emp.user_id).eq("status", "approved").is("payslip_id", null).eq("compensation_status", "pending").lte("work_date", run.period_end) : Promise.resolve({ data: [] as { id: string; work_date: string; minutes: number; approved_minutes: number | null; rate_multiplier: number | null; day_type: string }[] }),
    c.from("employee_bonuses").select("id, title, amount, currency").eq("employee_id", emp.id).eq("status", "approved").is("payslip_id", null).lte("pay_period", monthStart),
    emp.user_id && policy.include_commissions ? c.from("commissions").select("id, amount, currency, deals(name, deal_number)").eq("user_id", emp.user_id).eq("status", "approved").is("paid_at", null) : Promise.resolve({ data: [] as { id: string; amount: number; currency: string; deals: unknown }[] }),
    emp.user_id && policy.include_reimbursements ? c.from("expenses").select("id, description, amount, currency").eq("employee_user_id", emp.user_id).eq("reimbursable", true).eq("approval_status", "approved").eq("reimbursement_status", "pending").is("archived_at", null) : Promise.resolve({ data: [] as { id: string; description: string; amount: number; currency: string }[] }),
    c.from("loan_installments").select("id, seq, amount, employee_loans!inner(id, loan_type, currency, installments, status, employee_id, loan_number)").eq("employee_loans.employee_id", emp.id).eq("employee_loans.status", "active").eq("status", "scheduled").lte("due_period", monthStart),
  ]);

  const warnings: string[] = [];
  const recs = (records.data ?? []) as { status: string; late_minutes: number; overtime_minutes: number }[];
  let unpaidDays = 0;
  for (const l of (unpaid.data ?? []) as { start_date: string; end_date: string; half_day: boolean }[]) {
    const s = l.start_date > from ? l.start_date : from;
    const e = l.end_date < to ? l.end_date : to;
    const { data: n } = await c.rpc("bos_employee_work_days", { p_employee: emp.id, p_from: s, p_to: e });
    unpaidDays += l.half_day ? Math.min(0.5, Number(n ?? 0)) : Number(n ?? 0);
  }
  const sameCurrency = <T extends { currency: string }>(rows: T[], label: string) => {
    const other = rows.filter((r) => r.currency !== currency);
    if (other.length) warnings.push(`${other.length} ${label} بعملة مختلفة عن عملة الراتب (${currency}) — لم تُدرج.`);
    return rows.filter((r) => r.currency === currency);
  };
  const otRows = (overtime.data ?? []) as { id: string; work_date: string; minutes: number; approved_minutes: number | null; rate_multiplier: number | null; day_type: string }[];
  const multiplierFor = (dayType: string) => (dayType === "holiday" ? policy.overtime.holiday_multiplier : dayType === "day_off" ? policy.overtime.day_off_multiplier : policy.overtime.workday_multiplier);
  const otInput: PayrollInput["overtime"] = policy.overtime.source === "approved_requests"
    ? otRows.map((o) => ({ source_id: o.id, minutes: o.approved_minutes ?? o.minutes, multiplier: Number(o.rate_multiplier ?? multiplierFor(o.day_type)), label: `عمل إضافي ${o.work_date}` }))
    : [{ source_id: null, minutes: recs.reduce((s, r) => s + r.overtime_minutes, 0), multiplier: policy.overtime.workday_multiplier, label: "عمل إضافي (حسب الحضور)" }].filter((o) => o.minutes > 0);

  const compRows = ((components.data ?? []) as { id: string; amount: number; salary_components: unknown }[])
    .map((r) => ({ r, def: r.salary_components as { key: string; name: string; kind: "earning" | "deduction"; category: string; calc_type: "fixed" | "percent_of_basic"; taxable: boolean; is_active: boolean } | null }))
    .filter((x) => x.def);
  const componentInput: ComponentInput[] = compRows.map(({ r, def }) => ({ code: def!.key, label: def!.name, kind: def!.kind, category: def!.category, calc_type: def!.calc_type, value: String(r.amount), taxable: def!.taxable, source_id: r.id }));

  const input: PayrollInput = {
    currency,
    basic: String(comp.basic_salary),
    components: componentInput,
    period_working_days: Number(periodDays.data ?? 0),
    employed_working_days: Number(employedDays.data ?? 0),
    period_calendar_days: Math.round((Date.parse(run.period_end) - Date.parse(run.period_start)) / 86400000) + 1,
    employed_calendar_days: Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1),
    absent_days: recs.filter((r) => r.status === "absent").length,
    unpaid_leave_days: unpaidDays,
    late_minutes: recs.reduce((s, r) => s + r.late_minutes, 0),
    overtime: otInput,
    bonuses: sameCurrency((bonuses.data ?? []) as { id: string; title: string; amount: number; currency: string }[], "مكافأة").map((b) => ({ source_id: b.id, label: b.title, amount: String(b.amount) })),
    commissions: sameCurrency((commissions.data ?? []) as { id: string; amount: number; currency: string; deals: unknown }[], "عمولة").map((k) => ({ source_id: k.id, label: `عمولة — ${(k.deals as { name: string } | null)?.name ?? ""}`, amount: String(k.amount) })),
    reimbursements: sameCurrency((reimbursements.data ?? []) as { id: string; description: string; amount: number; currency: string }[], "مصروف مسترد").map((x) => ({ source_id: x.id, label: `استرداد: ${x.description}`, amount: String(x.amount) })),
    installments: ((installments.data ?? []) as { id: string; seq: number; amount: number; employee_loans: unknown }[])
      .map((i) => ({ i, loan: i.employee_loans as { loan_type: "loan" | "advance"; currency: string; installments: number; loan_number: string | null } }))
      .filter(({ loan }) => {
        if (loan.currency !== currency) warnings.push(`قسط ${loan.loan_number ?? ""} بعملة مختلفة — لم يُخصم.`);
        return loan.currency === currency;
      })
      .map(({ i, loan }) => ({ source_id: i.id, label: `${loan.loan_type === "advance" ? "سلفة" : "قسط قرض"} ${loan.loan_number ?? ""} (${i.seq}/${loan.installments})`, amount: String(i.amount), loan_type: loan.loan_type })),
    manual,
    policy,
  };
  return { input, warnings };
}

export async function calculateRun(bos: BosUser, runId: string) {
  const c = db();
  const { data: run } = await c.from("payroll_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) throw new NotFoundError();
  if (!["draft", "calculated"].includes(run.status)) throw new ValidationError("لا يمكن إعادة الحساب بعد إرسال الدورة للاعتماد.");
  const policy = await payrollPolicy();
  const emps = await eligibleEmployees(run);

  // Manual lines survive recalculation.
  const { data: existing } = await c.from("payslips").select("id, employee_id").eq("run_id", runId);
  const manualByEmployee = new Map<string, PayrollInput["manual"]>();
  if (existing?.length) {
    const { data: manual } = await c.from("payslip_lines").select("payslip_id, kind, label, amount, taxable").in("payslip_id", existing.map((p) => p.id)).eq("source_type", "manual");
    for (const p of existing) manualByEmployee.set(p.employee_id, (manual ?? []).filter((m) => m.payslip_id === p.id).map((m) => ({ kind: m.kind as "earning" | "deduction", label: m.label, amount: String(m.amount), taxable: m.taxable })));
    await c.from("payslips").delete().eq("run_id", runId);
  }

  const totals: Record<string, { gross: bigint; deductions: bigint; net: bigint; count: number }> = {};
  const missing: string[] = [];
  let count = 0;
  for (const emp of emps) {
    const built = await buildInput(run, emp, policy, manualByEmployee.get(emp.id) ?? []);
    if (!built) {
      missing.push(emp.full_name);
      continue;
    }
    const result = calculatePayslip(built.input);
    const { data: slip, error } = await c
      .from("payslips")
      .insert({
        run_id: runId,
        employee_id: emp.id,
        user_id: emp.user_id,
        currency: built.input.currency,
        basic_salary: Number(result.basic_salary),
        total_earnings: Number(result.total_earnings),
        total_deductions: Number(result.total_deductions),
        gross_pay: Number(result.gross_pay),
        taxable_pay: Number(result.taxable_pay),
        net_pay: Number(result.net_pay),
        working_days: built.input.period_working_days,
        paid_days: result.paid_days,
        absent_days: built.input.absent_days,
        unpaid_leave_days: built.input.unpaid_leave_days,
        late_minutes: built.input.late_minutes,
        overtime_minutes: built.input.overtime.reduce((s, o) => s + o.minutes, 0),
        warnings: [...built.warnings, ...result.warnings],
      })
      .select("id")
      .single();
    if (error) throw error;
    if (result.lines.length) {
      const { error: lineError } = await c.from("payslip_lines").insert(result.lines.map((l) => ({ ...l, payslip_id: slip.id, amount: Number(l.amount), rate: l.rate ? Number(String(l.rate).replace(/[^\d.]/g, "")) || null : null })));
      if (lineError) throw lineError;
    }
    const t = (totals[built.input.currency] ??= { gross: BigInt(0), deductions: BigInt(0), net: BigInt(0), count: 0 });
    t.gross += parseMoney(result.gross_pay) ?? BigInt(0);
    t.deductions += parseMoney(result.total_deductions) ?? BigInt(0);
    t.net += parseMoney(result.net_pay) ?? BigInt(0);
    t.count++;
    count++;
  }
  const totalsJson = Object.fromEntries(Object.entries(totals).map(([cur, t]) => [cur, { gross: toDecimalString(t.gross, decimalsFor(cur)), deductions: toDecimalString(t.deductions, decimalsFor(cur)), net: toDecimalString(t.net, decimalsFor(cur)), count: t.count }]));
  await c.from("payroll_runs").update({ status: "calculated", employee_count: count, totals: { ...totalsJson, missing_compensation: missing }, calculated_at: nowIso() }).eq("id", runId);
  if (run.status !== "calculated") await recordStatus("payroll_run", runId, run.status, "calculated", bos.userId);
  await audit({ actorId: bos.userId, action: "payroll.calculated", entityType: "payroll_run", entityId: runId, newValue: { employees: count, missing_compensation: missing.length } });
  return { count, missing };
}

// Manual earning/deduction on a draft payslip (e.g. leave encashment in a
// final settlement); recalculates that run.
export async function addManualLine(bos: BosUser, payslipId: string, input: { kind: "earning" | "deduction"; label: string; amount: string; taxable: boolean }) {
  const { data: slip } = await db().from("payslips").select("id, run_id, payroll_runs(status)").eq("id", payslipId).maybeSingle();
  if (!slip) throw new NotFoundError();
  if (!["draft", "calculated"].includes((slip.payroll_runs as unknown as { status: string }).status)) throw new ValidationError("الدورة ليست قابلة للتعديل.");
  if (!(parseMoney(input.amount) ?? BigInt(0))) throw new ValidationError("المبلغ مطلوب.", { amount: "مطلوب" });
  await db().from("payslip_lines").insert({ payslip_id: payslipId, kind: input.kind, category: input.kind === "earning" ? "other_earning" : "other_deduction", code: "manual", label: input.label, amount: Number(input.amount), taxable: input.taxable, source_type: "manual", sort_order: 900 });
  await audit({ actorId: bos.userId, action: "payroll.manual_line_added", entityType: "payroll_run", entityId: slip.run_id, newValue: { payslip_id: payslipId, ...input } });
  await calculateRun(bos, slip.run_id);
}

export async function removeManualLine(bos: BosUser, lineId: string) {
  const { data: line } = await db().from("payslip_lines").select("id, source_type, payslip_id, payslips(run_id, payroll_runs(status))").eq("id", lineId).maybeSingle();
  if (!line || line.source_type !== "manual") throw new NotFoundError();
  const slip = line.payslips as unknown as { run_id: string; payroll_runs: { status: string } };
  if (!["draft", "calculated"].includes(slip.payroll_runs.status)) throw new ValidationError("الدورة ليست قابلة للتعديل.");
  await db().from("payslip_lines").delete().eq("id", lineId);
  await audit({ actorId: bos.userId, action: "payroll.manual_line_removed", entityType: "payroll_run", entityId: slip.run_id, newValue: { line_id: lineId } });
  await calculateRun(bos, slip.run_id);
}

export async function submitRun(bos: BosUser, runId: string) {
  const { data: run } = await db().from("payroll_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) throw new NotFoundError();
  if (run.status !== "calculated") throw new ValidationError("احسب الدورة قبل إرسالها للاعتماد.");
  if (!run.employee_count) throw new ValidationError("لا توجد قسائم رواتب في هذه الدورة.");
  const { data: negative } = await db().from("payslips").select("id").eq("run_id", runId).lt("net_pay", 0).limit(1);
  if (negative?.length) throw new ValidationError("توجد قسائم بصافي سالب — عالجها قبل الإرسال.");
  const steps = await approvalSteps("payroll", ["role:finance"]);
  await db().from("payroll_runs").update({ status: "pending_approval", submitted_at: nowIso() }).eq("id", runId);
  await recordStatus("payroll_run", runId, "calculated", "pending_approval", bos.userId);
  await audit({ actorId: bos.userId, action: "payroll.submitted", entityType: "payroll_run", entityId: runId });
  await requestApproval({ type: "payroll", entityType: "payroll_run", entityId: runId, title: `رواتب ${run.period_start.slice(0, 7)} — ${run.run_number} (${run.employee_count} موظف)`, requestedBy: bos.userId, steps, payload: { totals: run.totals } });
}

// Called by the approval handler.
export async function applyRunDecision(runId: string, decision: "approved" | "rejected", actorId: string | null, comment: string | null) {
  const { data: run } = await db().from("payroll_runs").select("*").eq("id", runId).maybeSingle();
  if (!run || run.status !== "pending_approval") return;
  if (decision === "approved") {
    await db().from("payroll_runs").update({ status: "approved", approved_by: actorId, approved_at: nowIso() }).eq("id", runId);
    await db().from("payslips").update({ status: "final" }).eq("run_id", runId);
    await recordStatus("payroll_run", runId, "pending_approval", "approved", actorId, comment);
    await emitEvent({ type: "payroll.approved", entityType: "payroll_run", entityId: runId, summary: `Payroll approved: ${run.run_number} (${run.period_start.slice(0, 7)})`, actorId, payload: { creator_user_id: run.created_by } });
  } else {
    await db().from("payroll_runs").update({ status: "calculated" }).eq("id", runId);
    await recordStatus("payroll_run", runId, "pending_approval", "calculated", actorId, comment);
  }
  await audit({ actorId, action: `payroll.${decision}`, entityType: "payroll_run", entityId: runId, reason: comment });
}

export async function publishPayslips(bos: BosUser, runId: string) {
  const { data: run } = await db().from("payroll_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) throw new NotFoundError();
  if (!["approved", "paid"].includes(run.status)) throw new ValidationError("تُنشر القسائم بعد اعتماد الدورة.");
  const { data: slips } = await db().from("payslips").select("id, user_id, employee_id, net_pay, currency").eq("run_id", runId).is("published_at", null);
  const now = nowIso();
  for (const s of slips ?? []) {
    await db().from("payslips").update({ published_at: now }).eq("id", s.id);
    await emitEvent({ type: "payslip.published", entityType: "employee", entityId: s.employee_id, summary: `Payslip available: ${run.period_start.slice(0, 7)}`, actorId: bos.userId, payload: { employee_user_id: s.user_id, payslip_id: s.id }, dedupeKey: `payslip.published:${s.id}` });
  }
  await audit({ actorId: bos.userId, action: "payroll.published", entityType: "payroll_run", entityId: runId, newValue: { payslips: slips?.length ?? 0 } });
  return slips?.length ?? 0;
}

export async function markRunPaid(bos: BosUser, runId: string, input: { paid_on: string; reference: string | null }) {
  const c = db();
  const { data: run } = await c.from("payroll_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) throw new NotFoundError();
  if (run.status !== "approved") throw new ValidationError("تُدفع الدورة بعد اعتمادها فقط.");
  const policy = await payrollPolicy();
  const { data: category } = await c.from("expense_categories").select("id").eq("name", policy.salary_expense_category).maybeSingle();
  const categoryId = category?.id ?? (await c.from("expense_categories").select("id").eq("cost_type", "employee").eq("is_active", true).limit(1).maybeSingle()).data?.id;
  if (!categoryId) throw new ValidationError("أضف فئة مصروفات للرواتب في الإعدادات أولاً.");
  const { data: slips } = await c.from("payslips").select("*, employees(full_name)").eq("run_id", runId);
  const now = nowIso();
  const label = run.run_type === "final_settlement" ? "تسوية نهائية" : "رواتب";

  for (const s of slips ?? []) {
    const { data: lines } = await c.from("payslip_lines").select("*").eq("payslip_id", s.id);
    // Salary cost to the company = earnings except reimbursements (those are
    // already their own approved expense rows).
    const cost = addMoney(...(lines ?? []).filter((l) => l.kind === "earning" && l.category !== "reimbursement").map((l) => l.amount));
    const { data: expense, error } = await c
      .from("expenses")
      .insert({
        category_id: categoryId,
        description: `${label} ${run.period_start.slice(0, 7)} — ${(s.employees as unknown as { full_name: string } | null)?.full_name ?? ""} (${run.run_number})`,
        amount: Number(toDecimalString(cost, decimalsFor(s.currency))),
        currency: s.currency,
        expense_date: input.paid_on,
        employee_user_id: s.user_id,
        approval_status: "approved",
        approved_by: run.approved_by,
        approved_at: run.approved_at,
        created_by: bos.userId,
        expense_kind: "payroll",
        source_type: "payslip",
        source_id: s.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    await c.from("payslips").update({ status: "paid", paid_at: now, expense_id: expense.id, published_at: s.published_at ?? now }).eq("id", s.id);
    if (!s.published_at) await emitEvent({ type: "payslip.published", entityType: "employee", entityId: s.employee_id, summary: `Payslip available: ${run.period_start.slice(0, 7)}`, actorId: bos.userId, payload: { employee_user_id: s.user_id, payslip_id: s.id }, dedupeKey: `payslip.published:${s.id}` });

    // Settle every source that was paid through this payslip.
    for (const l of lines ?? []) {
      if (!l.source_id) continue;
      if (l.source_type === "overtime_request") await c.from("overtime_requests").update({ compensation_status: "paid", payslip_id: s.id, amount: l.amount, currency: s.currency }).eq("id", l.source_id);
      if (l.source_type === "employee_bonus") await c.from("employee_bonuses").update({ status: "paid", payslip_id: s.id }).eq("id", l.source_id);
      if (l.source_type === "commission") await c.from("commissions").update({ status: "paid", paid_at: now, payment_reference: `${run.run_number}${input.reference ? ` / ${input.reference}` : ""}` }).eq("id", l.source_id);
      if (l.source_type === "expense") await c.from("expenses").update({ reimbursement_status: "reimbursed", reimbursement_method: "payroll", reimbursed_at: now, payslip_id: s.id, reimbursement_reference: run.run_number }).eq("id", l.source_id);
      if (l.source_type === "loan_installment") {
        const { data: inst } = await c.from("loan_installments").update({ status: "deducted", payslip_id: s.id, settled_at: now }).eq("id", l.source_id).select("loan_id").single();
        if (inst) await settleLoanIfDone(inst.loan_id);
      }
    }
    if (run.run_type === "final_settlement") {
      await c.from("employee_separations").update({ final_settlement_payslip_id: s.id }).eq("employee_id", s.employee_id).neq("status", "cancelled");
    }
    await refreshEmployeeOnboardingSafe(s.employee_id, bos.userId);
  }
  await c.from("payroll_runs").update({ status: "paid", paid_at: now, paid_by: bos.userId, pay_date: run.pay_date ?? input.paid_on, notes: input.reference ? `${run.notes ?? ""}${run.notes ? "\n" : ""}مرجع الدفع: ${input.reference}` : run.notes }).eq("id", runId);
  await recordStatus("payroll_run", runId, "approved", "paid", bos.userId, input.reference);
  await audit({ actorId: bos.userId, action: "payroll.paid", entityType: "payroll_run", entityId: runId, newValue: { payslips: slips?.length ?? 0, paid_on: input.paid_on, reference: input.reference } });
  await emitEvent({ type: "payroll.paid", entityType: "payroll_run", entityId: runId, summary: `Payroll paid: ${run.run_number} (${run.period_start.slice(0, 7)})`, actorId: bos.userId, payload: {} });
}

export async function settleLoanIfDone(loanId: string) {
  const { count } = await db().from("loan_installments").select("id", { count: "exact", head: true }).eq("loan_id", loanId).eq("status", "scheduled");
  if (!count) {
    await db().from("employee_loans").update({ status: "settled", settled_at: nowIso() }).eq("id", loanId).eq("status", "active");
    await recordStatus("employee_loan", loanId, "active", "settled", null, "All installments settled");
  }
}

export async function cancelRun(bos: BosUser, runId: string, reason: string) {
  const { data: run } = await db().from("payroll_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) throw new NotFoundError();
  if (!["draft", "calculated", "pending_approval"].includes(run.status)) throw new ValidationError("لا يمكن إلغاء دورة معتمدة أو مدفوعة.");
  if (!reason) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
  await db().from("payroll_runs").update({ status: "cancelled", cancelled_reason: reason }).eq("id", runId);
  await db().from("payslips").update({ status: "void" }).eq("run_id", runId);
  await db().from("approvals").update({ status: "cancelled", decided_at: nowIso() }).eq("entity_type", "payroll_run").eq("entity_id", runId).eq("status", "pending");
  await recordStatus("payroll_run", runId, run.status, "cancelled", bos.userId, reason);
  await audit({ actorId: bos.userId, action: "payroll.cancelled", entityType: "payroll_run", entityId: runId, reason });
}

export async function listPayslips(f: { employee?: string; userId?: string; period?: string; status?: string; publishedOnly?: boolean; employeeIds?: string[] | null }) {
  let q = db().from("payslips").select("*, payroll_runs!inner(id, run_number, run_type, period_start, period_end, status), employees(id, user_id, full_name, employee_code, photo_updated_at, departments(name))").order("created_at", { ascending: false }).limit(500);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.employeeIds) q = q.in("employee_id", f.employeeIds.length ? f.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.period) q = q.eq("payroll_runs.period_start", `${f.period}-01`);
  if (f.status) q = q.eq("status", f.status);
  if (f.publishedOnly) q = q.not("published_at", "is", null).neq("status", "void");
  else q = q.neq("payroll_runs.status", "cancelled");
  const { data } = await q;
  return data ?? [];
}

export async function getPayslip(id: string) {
  const { data } = await db().from("payslips").select("*, payroll_runs(id, run_number, run_type, period_start, period_end, pay_date, status), employees(id, user_id, full_name, employee_code, position, departments(name))").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  const { data: lines } = await db().from("payslip_lines").select("*").eq("payslip_id", id).order("sort_order");
  return { ...data, lines: lines ?? [] };
}

export function monthAfter(date: string, months: number): string {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

