import "server-only";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { addDays } from "@/lib/bos/format";
import { peopleScope } from "@/services/bos/team-scope";
import { statusLabel } from "@/lib/bos/labels";

// HR reports (docs/bos/28 §28). One registry drives the report page and the
// CSV export, so both always show the same numbers. Scope: attendance and
// people follow reports.read (own/team/all + people the viewer manages);
// payroll needs payroll.read:all; recruitment needs recruitment.read.

export type HrReportGroup = "attendance" | "payroll" | "people" | "recruitment";
export interface HrReportColumn {
  key: string;
  label: string;
  kind?: "money" | "minutes" | "number" | "date";
}
export interface HrReportFilters {
  from: string;
  to: string;
  department?: string;
  employee?: string;
  currency?: string;
}
interface HrReportDef {
  group: HrReportGroup;
  title: string;
  columns: HrReportColumn[];
  allowed: (bos: BosUser) => boolean;
  run: (bos: BosUser, f: HrReportFilters) => Promise<Record<string, unknown>[]>;
}

export const hrReportGroups: Record<HrReportGroup, string> = { attendance: "الحضور", payroll: "الرواتب", people: "الموظفون", recruitment: "التوظيف" };

const canPeople = (bos: BosUser) => bos.permissions.has("reports.read");
const canPayroll = (bos: BosUser) => bos.permissions.has("reports.read") && bos.permissions.get("payroll.read") === "all";
const canRecruitment = (bos: BosUser) => bos.permissions.has("reports.read") && bos.permissions.has("recruitment.read");

async function scopedEmployees(bos: BosUser, f: HrReportFilters) {
  const { users } = await peopleScope(bos, "reports.read");
  let q = db().from("employees").select("id, user_id, full_name, employee_code, position, department_id, employment_type, lifecycle_status, start_date, departments(name)");
  if (users) q = q.in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
  if (f.department) q = q.eq("department_id", f.department);
  if (f.employee) q = q.eq("id", f.employee);
  const { data } = await q;
  return (data ?? []).map((e) => ({ ...e, department: (e.departments as unknown as { name: string } | null)?.name ?? "—" }));
}

async function recordsFor(userIds: string[], f: HrReportFilters) {
  if (!userIds.length) return [];
  const { data } = await db().from("attendance_records").select("user_id, work_date, status, first_clock_in, last_clock_out, worked_minutes, expected_minutes, late_minutes, overtime_minutes, timezone").in("user_id", userIds).gte("work_date", f.from).lte("work_date", f.to).order("work_date");
  return data ?? [];
}

const time = (iso: string | null, tz: string) => (iso ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso)) : "");

export const hrReports: Record<string, HrReportDef> = {
  // ------------------------------ Attendance ------------------------------
  attendance_daily: {
    group: "attendance",
    title: "الحضور اليومي",
    columns: [{ key: "date", label: "التاريخ", kind: "date" }, { key: "employee", label: "الموظف" }, { key: "department", label: "القسم" }, { key: "status", label: "الحالة" }, { key: "check_in", label: "الدخول" }, { key: "check_out", label: "الخروج" }, { key: "worked", label: "ساعات العمل", kind: "minutes" }, { key: "late", label: "التأخير", kind: "minutes" }, { key: "overtime", label: "إضافي", kind: "minutes" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      const byUser = new Map(emps.filter((e) => e.user_id).map((e) => [e.user_id as string, e]));
      const recs = await recordsFor([...byUser.keys()], f);
      return recs.map((r) => ({ date: r.work_date, employee: byUser.get(r.user_id)?.full_name, department: byUser.get(r.user_id)?.department, status: statusLabel("attendance_status", r.status), check_in: time(r.first_clock_in, r.timezone), check_out: time(r.last_clock_out, r.timezone), worked: r.worked_minutes, late: r.late_minutes, overtime: r.overtime_minutes }));
    },
  },
  attendance_monthly: {
    group: "attendance",
    title: "الحضور الشهري",
    columns: [{ key: "employee", label: "الموظف" }, { key: "department", label: "القسم" }, { key: "present", label: "أيام الحضور", kind: "number" }, { key: "late_days", label: "أيام التأخير", kind: "number" }, { key: "absent", label: "الغياب", kind: "number" }, { key: "leave", label: "الإجازات", kind: "number" }, { key: "day_off", label: "أيام الراحة/العطل", kind: "number" }, { key: "worked", label: "ساعات العمل", kind: "minutes" }, { key: "expected", label: "المتوقع", kind: "minutes" }, { key: "overtime", label: "إضافي", kind: "minutes" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      const recs = await recordsFor(emps.map((e) => e.user_id).filter(Boolean) as string[], f);
      return emps.filter((e) => e.user_id).map((e) => {
        const mine = recs.filter((r) => r.user_id === e.user_id);
        return {
          employee: e.full_name,
          department: e.department,
          present: mine.filter((r) => ["present", "late", "overtime", "remote", "half_day", "on_break"].includes(r.status)).length,
          late_days: mine.filter((r) => r.late_minutes > 0).length,
          absent: mine.filter((r) => r.status === "absent").length,
          leave: mine.filter((r) => r.status === "leave").length,
          day_off: mine.filter((r) => ["day_off", "holiday"].includes(r.status)).length,
          worked: mine.reduce((s, r) => s + r.worked_minutes, 0),
          expected: mine.reduce((s, r) => s + r.expected_minutes, 0),
          overtime: mine.reduce((s, r) => s + r.overtime_minutes, 0),
        };
      });
    },
  },
  late: {
    group: "attendance",
    title: "تقرير التأخير",
    columns: [{ key: "date", label: "التاريخ", kind: "date" }, { key: "employee", label: "الموظف" }, { key: "department", label: "القسم" }, { key: "check_in", label: "الدخول" }, { key: "late", label: "مدة التأخير", kind: "minutes" }],
    allowed: canPeople,
    async run(bos, f) {
      const rows = await hrReports.attendance_daily.run(bos, f);
      return rows.filter((r) => Number(r.late) > 0).map((r) => ({ date: r.date, employee: r.employee, department: r.department, check_in: r.check_in, late: r.late }));
    },
  },
  absence: {
    group: "attendance",
    title: "تقرير الغياب",
    columns: [{ key: "date", label: "التاريخ", kind: "date" }, { key: "employee", label: "الموظف" }, { key: "department", label: "القسم" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      const byUser = new Map(emps.filter((e) => e.user_id).map((e) => [e.user_id as string, e]));
      const recs = await recordsFor([...byUser.keys()], f);
      return recs.filter((r) => r.status === "absent").map((r) => ({ date: r.work_date, employee: byUser.get(r.user_id)?.full_name, department: byUser.get(r.user_id)?.department }));
    },
  },
  overtime: {
    group: "attendance",
    title: "تقرير العمل الإضافي",
    columns: [{ key: "date", label: "التاريخ", kind: "date" }, { key: "employee", label: "الموظف" }, { key: "actual", label: "الفعلي (الحضور)", kind: "minutes" }, { key: "requested", label: "المطلوب", kind: "minutes" }, { key: "approved", label: "المعتمد", kind: "minutes" }, { key: "status", label: "الحالة" }, { key: "multiplier", label: "المعامل" }, { key: "amount", label: "المبلغ المصروف", kind: "money" }, { key: "currency", label: "العملة" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      const byUser = new Map(emps.filter((e) => e.user_id).map((e) => [e.user_id as string, e]));
      if (!byUser.size) return [];
      const { data } = await db().from("overtime_requests").select("*").in("user_id", [...byUser.keys()]).gte("work_date", f.from).lte("work_date", f.to).order("work_date");
      const payroll = canPayroll(bos);
      return (data ?? []).map((o) => ({ date: o.work_date, employee: byUser.get(o.user_id)?.full_name, actual: o.actual_minutes, requested: o.minutes, approved: o.approved_minutes, status: statusLabel("overtime_status", o.status), multiplier: o.rate_multiplier, amount: payroll ? o.amount : null, currency: payroll ? o.currency : null }));
    },
  },
  working_hours: {
    group: "attendance",
    title: "ساعات العمل",
    columns: [{ key: "employee", label: "الموظف" }, { key: "department", label: "القسم" }, { key: "expected", label: "المتوقع", kind: "minutes" }, { key: "worked", label: "الفعلي", kind: "minutes" }, { key: "difference", label: "الفرق", kind: "minutes" }],
    allowed: canPeople,
    async run(bos, f) {
      const monthly = await hrReports.attendance_monthly.run(bos, f);
      return monthly.map((m) => ({ employee: m.employee, department: m.department, expected: m.expected, worked: m.worked, difference: Number(m.worked) - Number(m.expected) }));
    },
  },

  // ------------------------------ Payroll ------------------------------
  payroll_summary: {
    group: "payroll",
    title: "ملخص الرواتب",
    columns: [{ key: "run", label: "الدورة" }, { key: "period", label: "الفترة" }, { key: "type", label: "النوع" }, { key: "status", label: "الحالة" }, { key: "employees", label: "الموظفون", kind: "number" }, { key: "currency", label: "العملة" }, { key: "gross", label: "الإجمالي", kind: "money" }, { key: "deductions", label: "الاستقطاعات", kind: "money" }, { key: "net", label: "الصافي", kind: "money" }],
    allowed: canPayroll,
    async run(_bos, f) {
      const { data } = await db().from("payroll_runs").select("*").gte("period_start", f.from.slice(0, 7) + "-01").lte("period_start", f.to).neq("status", "cancelled").order("period_start");
      return (data ?? []).flatMap((r) => Object.entries((r.totals ?? {}) as Record<string, { gross?: string; deductions?: string; net?: string; count?: number }>).filter(([k]) => /^[A-Z]{3}$/.test(k)).map(([cur, t]) => ({ run: r.run_number, period: r.period_start.slice(0, 7), type: statusLabel("payroll_run_type", r.run_type), status: statusLabel("payroll_run_status", r.status), employees: t.count, currency: cur, gross: t.gross, deductions: t.deductions, net: t.net })));
    },
  },
  salary_cost: {
    group: "payroll",
    title: "تكلفة الرواتب حسب القسم",
    columns: [{ key: "department", label: "القسم" }, { key: "currency", label: "العملة" }, { key: "employees", label: "الموظفون", kind: "number" }, { key: "basic", label: "الأساسي", kind: "money" }, { key: "gross", label: "الإجمالي (تكلفة)", kind: "money" }, { key: "net", label: "الصافي", kind: "money" }],
    allowed: canPayroll,
    async run(_bos, f) {
      const slips = await payslipsInRange(f);
      const groups = new Map<string, { department: string; currency: string; employees: Set<string>; basic: number; gross: number; net: number }>();
      for (const s of slips) {
        const dept = (s.employees as unknown as { departments: { name: string } | null } | null)?.departments?.name ?? "—";
        const key = `${dept}|${s.currency}`;
        const g = groups.get(key) ?? { department: dept, currency: s.currency, employees: new Set<string>(), basic: 0, gross: 0, net: 0 };
        g.employees.add(s.employee_id);
        g.basic += Number(s.basic_salary);
        g.gross += Number(s.gross_pay);
        g.net += Number(s.net_pay);
        groups.set(key, g);
      }
      return [...groups.values()].map((g) => ({ department: g.department, currency: g.currency, employees: g.employees.size, basic: g.basic.toFixed(2), gross: g.gross.toFixed(2), net: g.net.toFixed(2) }));
    },
  },
  bonuses: {
    group: "payroll",
    title: "المكافآت",
    columns: [{ key: "employee", label: "الموظف" }, { key: "type", label: "النوع" }, { key: "title", label: "البيان" }, { key: "period", label: "شهر الصرف" }, { key: "status", label: "الحالة" }, { key: "amount", label: "المبلغ", kind: "money" }, { key: "currency", label: "العملة" }],
    allowed: canPayroll,
    async run(_bos, f) {
      const { data } = await db().from("employee_bonuses").select("*, employees(full_name)").gte("pay_period", f.from.slice(0, 7) + "-01").lte("pay_period", f.to).order("pay_period");
      return (data ?? []).map((b) => ({ employee: (b.employees as unknown as { full_name: string } | null)?.full_name, type: statusLabel("bonus_type", b.bonus_type), title: b.title, period: b.pay_period.slice(0, 7), status: statusLabel("bonus_status", b.status), amount: b.amount, currency: b.currency }));
    },
  },
  deductions: {
    group: "payroll",
    title: "الاستقطاعات حسب النوع",
    columns: [{ key: "category", label: "النوع" }, { key: "currency", label: "العملة" }, { key: "lines", label: "عدد البنود", kind: "number" }, { key: "amount", label: "الإجمالي", kind: "money" }],
    allowed: canPayroll,
    async run(_bos, f) {
      const slips = await payslipsInRange(f);
      if (!slips.length) return [];
      const { data: lines } = await db().from("payslip_lines").select("payslip_id, category, amount").eq("kind", "deduction").in("payslip_id", slips.map((s) => s.id));
      const cur = new Map(slips.map((s) => [s.id, s.currency]));
      const groups = new Map<string, { category: string; currency: string; lines: number; amount: number }>();
      for (const l of lines ?? []) {
        const key = `${l.category}|${cur.get(l.payslip_id)}`;
        const g = groups.get(key) ?? { category: deductionLabels[l.category] ?? l.category, currency: cur.get(l.payslip_id) ?? "", lines: 0, amount: 0 };
        g.lines++;
        g.amount += Number(l.amount);
        groups.set(key, g);
      }
      return [...groups.values()].map((g) => ({ ...g, amount: g.amount.toFixed(2) }));
    },
  },
  loans: {
    group: "payroll",
    title: "القروض والسلف",
    columns: [{ key: "number", label: "الرقم" }, { key: "employee", label: "الموظف" }, { key: "type", label: "النوع" }, { key: "status", label: "الحالة" }, { key: "amount", label: "المبلغ", kind: "money" }, { key: "installment", label: "القسط الشهري", kind: "money" }, { key: "paid", label: "المسدد", kind: "money" }, { key: "remaining", label: "المتبقي", kind: "money" }, { key: "currency", label: "العملة" }],
    allowed: canPayroll,
    async run() {
      const { data } = await db().from("employee_loans").select("*, employees(full_name), loan_installments(amount, status)").not("status", "in", "(rejected,cancelled)").order("created_at", { ascending: false });
      return (data ?? []).map((l) => {
        const paid = ((l.loan_installments as { amount: number; status: string }[]) ?? []).filter((i) => ["deducted", "paid_manually", "waived"].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0);
        return { number: l.loan_number, employee: (l.employees as unknown as { full_name: string } | null)?.full_name, type: statusLabel("loan_type", l.loan_type), status: statusLabel("loan_status", l.status), amount: l.amount, installment: l.installment_amount, paid: paid.toFixed(2), remaining: Math.max(0, Number(l.amount) - paid).toFixed(2), currency: l.currency };
      });
    },
  },
  overtime_cost: {
    group: "payroll",
    title: "تكلفة العمل الإضافي",
    columns: [{ key: "employee", label: "الموظف" }, { key: "period", label: "الفترة" }, { key: "hours", label: "الساعات", kind: "number" }, { key: "amount", label: "المبلغ", kind: "money" }, { key: "currency", label: "العملة" }],
    allowed: canPayroll,
    async run(_bos, f) {
      const slips = await payslipsInRange(f);
      if (!slips.length) return [];
      const { data: lines } = await db().from("payslip_lines").select("payslip_id, quantity, amount").eq("category", "overtime").in("payslip_id", slips.map((s) => s.id));
      return slips.map((s) => {
        const mine = (lines ?? []).filter((l) => l.payslip_id === s.id);
        return { employee: (s.employees as unknown as { full_name: string } | null)?.full_name, period: (s.payroll_runs as unknown as { period_start: string }).period_start.slice(0, 7), hours: mine.reduce((a, l) => a + Number(l.quantity ?? 0), 0), amount: mine.reduce((a, l) => a + Number(l.amount), 0).toFixed(2), currency: s.currency };
      }).filter((r) => Number(r.amount) > 0);
    },
  },

  // ------------------------------ People ------------------------------
  headcount: {
    group: "people",
    title: "عدد الموظفين",
    columns: [{ key: "status", label: "الحالة" }, { key: "count", label: "العدد", kind: "number" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      const counts = new Map<string, number>();
      for (const e of emps) counts.set(e.lifecycle_status, (counts.get(e.lifecycle_status) ?? 0) + 1);
      return [...counts.entries()].map(([s, n]) => ({ status: statusLabel("employee_lifecycle_status", s), count: n }));
    },
  },
  new_hires: {
    group: "people",
    title: "التعيينات الجديدة",
    columns: [{ key: "employee", label: "الموظف" }, { key: "code", label: "الكود" }, { key: "position", label: "المسمى" }, { key: "department", label: "القسم" }, { key: "type", label: "نوع التوظيف" }, { key: "start", label: "تاريخ التعيين", kind: "date" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      return emps.filter((e) => e.start_date && e.start_date >= f.from && e.start_date <= f.to).map((e) => ({ employee: e.full_name, code: e.employee_code, position: e.position, department: e.department, type: statusLabel("employment_type", e.employment_type), start: e.start_date }));
    },
  },
  terminations: {
    group: "people",
    title: "انتهاء الخدمة",
    columns: [{ key: "employee", label: "الموظف" }, { key: "department", label: "القسم" }, { key: "type", label: "نوع الانتهاء" }, { key: "last_day", label: "آخر يوم عمل", kind: "date" }, { key: "status", label: "الحالة" }, { key: "rehire", label: "مؤهل لإعادة التعيين" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      const ids = emps.map((e) => e.id);
      if (!ids.length) return [];
      const { data } = await db().from("employee_separations").select("*").in("employee_id", ids).neq("status", "cancelled");
      return (data ?? []).filter((s) => { const d = s.last_working_day ?? s.created_at.slice(0, 10); return d >= f.from && d <= f.to; }).map((s) => {
        const e = emps.find((x) => x.id === s.employee_id);
        return { employee: e?.full_name, department: e?.department, type: statusLabel("separation_type", s.separation_type), last_day: s.last_working_day, status: s.status === "completed" ? "مكتمل" : "قيد التنفيذ", rehire: s.rehire_eligible == null ? "—" : s.rehire_eligible ? "نعم" : "لا" };
      });
    },
  },
  turnover: {
    group: "people",
    title: "معدل دوران الموظفين",
    columns: [{ key: "month", label: "الشهر" }, { key: "headcount_start", label: "العدد أول الشهر", kind: "number" }, { key: "hires", label: "تعيينات", kind: "number" }, { key: "leavers", label: "مغادرون", kind: "number" }, { key: "turnover", label: "معدل الدوران %", kind: "number" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      const { data: seps } = emps.length ? await db().from("employee_separations").select("employee_id, last_working_day, created_at").in("employee_id", emps.map((e) => e.id)).eq("status", "completed") : { data: [] };
      const leftOn = new Map((seps ?? []).map((s) => [s.employee_id, s.last_working_day ?? s.created_at.slice(0, 10)]));
      const rows = [];
      for (let m = f.from.slice(0, 7); m <= f.to.slice(0, 7); ) {
        const start = `${m}-01`;
        const next = new Date(`${start}T00:00:00Z`);
        next.setUTCMonth(next.getUTCMonth() + 1);
        const end = addDays(next.toISOString().slice(0, 10), -1);
        const atStart = emps.filter((e) => (!e.start_date || e.start_date < start) && (!leftOn.get(e.id) || (leftOn.get(e.id) as string) >= start)).length;
        const hires = emps.filter((e) => e.start_date && e.start_date >= start && e.start_date <= end).length;
        const leavers = [...leftOn.entries()].filter(([, d]) => d >= start && d <= end).length;
        const avg = (atStart + (atStart + hires - leavers)) / 2;
        rows.push({ month: m, headcount_start: atStart, hires, leavers, turnover: avg ? Math.round((leavers / avg) * 1000) / 10 : 0 });
        m = next.toISOString().slice(0, 7);
      }
      return rows;
    },
  },
  departments: {
    group: "people",
    title: "التوزيع حسب القسم",
    columns: [{ key: "department", label: "القسم" }, { key: "active", label: "نشط", kind: "number" }, { key: "total", label: "الإجمالي", kind: "number" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = await scopedEmployees(bos, f);
      const groups = new Map<string, { active: number; total: number }>();
      for (const e of emps.filter((x) => !["terminated", "archived"].includes(x.lifecycle_status))) {
        const g = groups.get(e.department) ?? { active: 0, total: 0 };
        g.total++;
        if (e.lifecycle_status === "active") g.active++;
        groups.set(e.department, g);
      }
      return [...groups.entries()].map(([department, g]) => ({ department, ...g }));
    },
  },
  employment_types: {
    group: "people",
    title: "أنواع التوظيف",
    columns: [{ key: "type", label: "نوع التوظيف" }, { key: "count", label: "العدد", kind: "number" }],
    allowed: canPeople,
    async run(bos, f) {
      const emps = (await scopedEmployees(bos, f)).filter((x) => !["terminated", "archived"].includes(x.lifecycle_status));
      const counts = new Map<string, number>();
      for (const e of emps) counts.set(e.employment_type, (counts.get(e.employment_type) ?? 0) + 1);
      return [...counts.entries()].map(([t, n]) => ({ type: statusLabel("employment_type", t), count: n }));
    },
  },

  // ------------------------------ Recruitment ------------------------------
  open_positions: {
    group: "recruitment",
    title: "الوظائف المفتوحة",
    columns: [{ key: "job", label: "الوظيفة" }, { key: "department", label: "القسم" }, { key: "status", label: "الحالة" }, { key: "published", label: "منشورة" }, { key: "openings", label: "الشواغر", kind: "number" }, { key: "applications", label: "الطلبات", kind: "number" }, { key: "hired", label: "تم التعيين", kind: "number" }],
    allowed: canRecruitment,
    async run() {
      const { data: jobs } = await db().from("career_jobs").select("id, title, status, is_published, openings, departments(name)").in("status", ["open", "on_hold"]);
      const { data: apps } = jobs?.length ? await db().from("career_applications").select("job_id, status").in("job_id", jobs.map((j) => j.id)) : { data: [] };
      return (jobs ?? []).map((j) => ({ job: j.title, department: (j.departments as unknown as { name: string } | null)?.name ?? "—", status: statusLabel("job_status", j.status), published: j.is_published ? "نعم" : "لا", openings: j.openings, applications: (apps ?? []).filter((a) => a.job_id === j.id).length, hired: (apps ?? []).filter((a) => a.job_id === j.id && a.status === "hired").length }));
    },
  },
  applications: {
    group: "recruitment",
    title: "الطلبات",
    columns: [{ key: "date", label: "تاريخ التقديم", kind: "date" }, { key: "candidate", label: "المرشح" }, { key: "job", label: "الوظيفة" }, { key: "source", label: "المصدر" }, { key: "stage", label: "المرحلة" }],
    allowed: canRecruitment,
    async run(_bos, f) {
      const { data } = await db().from("career_applications").select("created_at, first_name, last_name, source, status, career_jobs(title)").gte("created_at", `${f.from}T00:00:00Z`).lte("created_at", `${f.to}T23:59:59Z`).order("created_at");
      return (data ?? []).map((a) => ({ date: a.created_at.slice(0, 10), candidate: `${a.first_name} ${a.last_name}`, job: (a.career_jobs as unknown as { title: string } | null)?.title, source: a.source, stage: statusLabel("application_status", a.status) }));
    },
  },
  candidates_by_stage: {
    group: "recruitment",
    title: "المرشحون حسب المرحلة",
    columns: [{ key: "stage", label: "المرحلة" }, { key: "count", label: "العدد", kind: "number" }],
    allowed: canRecruitment,
    async run() {
      const { data } = await db().from("career_applications").select("status");
      const counts = new Map<string, number>();
      for (const a of data ?? []) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
      return [...counts.entries()].map(([s, n]) => ({ stage: statusLabel("application_status", s), count: n }));
    },
  },
  interviews: {
    group: "recruitment",
    title: "المقابلات",
    columns: [{ key: "date", label: "الموعد", kind: "date" }, { key: "candidate", label: "المرشح" }, { key: "job", label: "الوظيفة" }, { key: "round", label: "الجولة", kind: "number" }, { key: "interviewer", label: "المُقابِل" }, { key: "status", label: "الحالة" }, { key: "outcome", label: "النتيجة" }, { key: "avg_rating", label: "متوسط التقييم", kind: "number" }],
    allowed: canRecruitment,
    async run(_bos, f) {
      const { data } = await db().from("career_interviews").select("scheduled_at, round, interviewer_name, status, outcome, career_applications(first_name, last_name, career_jobs(title)), interview_feedback(rating)").gte("scheduled_at", `${f.from}T00:00:00Z`).lte("scheduled_at", `${f.to}T23:59:59Z`).order("scheduled_at");
      return (data ?? []).map((i) => {
        const a = i.career_applications as unknown as { first_name: string; last_name: string; career_jobs: { title: string } | null } | null;
        const ratings = ((i.interview_feedback as { rating: number }[]) ?? []).map((x) => x.rating);
        return { date: i.scheduled_at.slice(0, 10), candidate: a ? `${a.first_name} ${a.last_name}` : "", job: a?.career_jobs?.title, round: i.round, interviewer: i.interviewer_name, status: statusLabel("interview_status", i.status), outcome: statusLabel("interview_outcome", i.outcome), avg_rating: ratings.length ? Math.round((ratings.reduce((s, x) => s + x, 0) / ratings.length) * 10) / 10 : null };
      });
    },
  },
  hires: {
    group: "recruitment",
    title: "التعيينات من التوظيف",
    columns: [{ key: "candidate", label: "المرشح" }, { key: "job", label: "الوظيفة" }, { key: "date", label: "تاريخ التعيين", kind: "date" }],
    allowed: canRecruitment,
    async run(_bos, f) {
      const { data } = await db().from("career_applications").select("first_name, last_name, stage_changed_at, career_jobs(title)").eq("status", "hired").gte("stage_changed_at", `${f.from}T00:00:00Z`).lte("stage_changed_at", `${f.to}T23:59:59Z`);
      return (data ?? []).map((a) => ({ candidate: `${a.first_name} ${a.last_name}`, job: (a.career_jobs as unknown as { title: string } | null)?.title, date: a.stage_changed_at?.slice(0, 10) }));
    },
  },
  rejections: {
    group: "recruitment",
    title: "الرفض",
    columns: [{ key: "candidate", label: "المرشح" }, { key: "job", label: "الوظيفة" }, { key: "date", label: "التاريخ", kind: "date" }, { key: "reason", label: "السبب" }],
    allowed: canRecruitment,
    async run(_bos, f) {
      const { data } = await db().from("career_applications").select("first_name, last_name, stage_changed_at, rejection_reason, internal_notes, career_jobs(title)").eq("status", "rejected").gte("stage_changed_at", `${f.from}T00:00:00Z`).lte("stage_changed_at", `${f.to}T23:59:59Z`);
      return (data ?? []).map((a) => ({ candidate: `${a.first_name} ${a.last_name}`, job: (a.career_jobs as unknown as { title: string } | null)?.title, date: a.stage_changed_at?.slice(0, 10), reason: a.rejection_reason ?? a.internal_notes }));
    },
  },
};

const deductionLabels: Record<string, string> = { absence: "غياب", unpaid_leave: "إجازة بدون أجر", late: "تأخير", tax: "ضرائب", insurance: "تأمينات", loan: "أقساط قروض", advance: "سلف", other_deduction: "استقطاعات أخرى" };

async function payslipsInRange(f: HrReportFilters) {
  let q = db().from("payslips").select("id, employee_id, currency, basic_salary, gross_pay, net_pay, employees(full_name, department_id, departments(name)), payroll_runs!inner(period_start, status)").gte("payroll_runs.period_start", f.from.slice(0, 7) + "-01").lte("payroll_runs.period_start", f.to).neq("payroll_runs.status", "cancelled");
  if (f.employee) q = q.eq("employee_id", f.employee);
  const { data } = await q;
  const rows = data ?? [];
  return f.department ? rows.filter((s) => (s.employees as unknown as { department_id: string | null } | null)?.department_id === f.department) : rows;
}

export async function runHrReport(bos: BosUser, key: string, f: HrReportFilters) {
  const def = hrReports[key];
  if (!def || !def.allowed(bos)) return null;
  return { def, rows: await def.run(bos, f) };
}
