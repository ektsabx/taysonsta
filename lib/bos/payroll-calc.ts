// Payroll calculation (docs/bos/28 §16–18). Pure and deterministic: every
// input is passed in and every result is a payslip line, so a payslip can be
// explained line by line and unit-tested. Money is bigint thousandths
// (lib/bos/money.ts) — never floats.

import { decimalsFor, parseMoney, toDecimalString } from "@/lib/bos/money";

const ZERO = BigInt(0);
const THOUSAND = BigInt(1000);

export interface PayrollPolicyInput {
  working_days_basis: "schedule" | "fixed_30";
  absence_deduction: boolean;
  unpaid_leave_deduction: boolean;
  late_deduction: "none" | "per_minute";
  late_grace_minutes_per_month: number;
  overtime: { standard_monthly_hours: number };
  tax: { enabled: boolean; exemption_monthly: number; brackets: { up_to: number | null; rate: number }[] };
  insurance: { enabled: boolean; employee_percent: number; basis: "basic" | "gross"; cap_monthly: number | null };
}

export interface ComponentInput {
  code: string;
  label: string;
  kind: "earning" | "deduction";
  category: string;
  calc_type: "fixed" | "percent_of_basic";
  value: string;
  taxable: boolean;
  source_id: string;
}

export interface PayrollInput {
  currency: string;
  basic: string;
  components: ComponentInput[];
  // Days: scheduled working days in the whole period, and the ones the
  // person was employed for (join / last day proration).
  period_working_days: number;
  employed_working_days: number;
  period_calendar_days: number;
  employed_calendar_days: number;
  absent_days: number;
  unpaid_leave_days: number;
  late_minutes: number;
  overtime: { source_id: string | null; minutes: number; multiplier: number; label: string }[];
  bonuses: { source_id: string; label: string; amount: string }[];
  commissions: { source_id: string; label: string; amount: string }[];
  reimbursements: { source_id: string; label: string; amount: string }[];
  installments: { source_id: string; label: string; amount: string; loan_type: "loan" | "advance" }[];
  manual: { kind: "earning" | "deduction"; label: string; amount: string; taxable: boolean }[];
  policy: PayrollPolicyInput;
}

export interface PayrollLine {
  kind: "earning" | "deduction";
  category: string;
  code: string;
  label: string;
  quantity: number | null;
  rate: string | null;
  amount: string;
  taxable: boolean;
  source_type: string | null;
  source_id: string | null;
  sort_order: number;
}

export interface PayrollResult {
  lines: PayrollLine[];
  basic_salary: string;
  total_earnings: string;
  total_deductions: string;
  gross_pay: string;
  taxable_pay: string;
  net_pay: string;
  paid_days: number;
  warnings: string[];
}

// units × num / den, half-up to the currency's decimals (in thousandths).
function mulDiv(units: bigint, num: bigint, den: bigint, currency: string): bigint {
  if (den === ZERO) return ZERO;
  const step = BigInt(10 ** (3 - decimalsFor(currency)));
  const n = units * num;
  const negative = n < ZERO;
  const abs = negative ? -n : n;
  const d = den * step;
  let q = abs / d;
  if ((abs % d) * BigInt(2) >= d) q += BigInt(1);
  const r = q * step;
  return negative ? -r : r;
}

// Decimal number → thousandths bigint (for ratios like 1.5 or 17.5 hours).
function milli(value: number): bigint {
  return BigInt(Math.round(value * 1000));
}

function money(value: unknown): bigint {
  return parseMoney(value) ?? ZERO;
}

// Progressive monthly tax on taxable pay after the exemption.
export function progressiveTax(taxable: bigint, policy: PayrollPolicyInput["tax"], currency: string): bigint {
  if (!policy.enabled) return ZERO;
  let base = taxable - money(policy.exemption_monthly);
  if (base <= ZERO) return ZERO;
  let tax = ZERO;
  let lower = ZERO;
  for (const b of policy.brackets) {
    const upper = b.up_to === null ? null : money(b.up_to);
    const slice = upper === null ? base : (base < upper - lower ? base : upper - lower);
    if (slice <= ZERO) break;
    tax += mulDiv(slice, milli(b.rate), BigInt(100) * THOUSAND, currency);
    base -= slice;
    if (upper === null) break;
    lower = upper;
    if (base <= ZERO) break;
  }
  return tax;
}

export function calculatePayslip(input: PayrollInput): PayrollResult {
  const c = input.currency;
  const dec = decimalsFor(c);
  const fmt = (u: bigint) => toDecimalString(u, dec);
  const lines: PayrollLine[] = [];
  const warnings: string[] = [];
  let sort = 0;
  const push = (l: Omit<PayrollLine, "sort_order" | "amount"> & { amount: bigint }) => {
    if (l.amount <= ZERO) return;
    lines.push({ ...l, amount: fmt(l.amount), sort_order: (sort += 10) });
  };

  const basic = money(input.basic);
  const fixed30 = input.policy.working_days_basis === "fixed_30";
  const periodDays = fixed30 ? 30 : Math.max(0, input.period_working_days);
  const employedDays = fixed30 ? Math.min(30, Math.round((input.employed_calendar_days / Math.max(1, input.period_calendar_days)) * 30)) : Math.max(0, input.employed_working_days);
  const fullPeriod = employedDays >= periodDays;
  // Proration ratio (employed / period) as a rational number.
  const ratioNum = fullPeriod ? BigInt(1) : BigInt(employedDays);
  const ratioDen = fullPeriod ? BigInt(1) : BigInt(Math.max(1, periodDays));
  if (!periodDays) warnings.push("لا توجد أيام عمل مجدولة في الفترة؛ راجع جدول العمل.");

  const earnedBasic = mulDiv(basic, ratioNum, ratioDen, c);
  push({ kind: "earning", category: "basic", code: "basic", label: fullPeriod ? "الراتب الأساسي" : `الراتب الأساسي (${employedDays}/${periodDays} يوم)`, quantity: fullPeriod ? null : employedDays, rate: null, amount: earnedBasic, taxable: true, source_type: "compensation", source_id: null });

  for (const comp of input.components) {
    const full = comp.calc_type === "percent_of_basic" ? mulDiv(basic, money(comp.value), BigInt(100) * THOUSAND, c) : money(comp.value);
    const amount = mulDiv(full, ratioNum, ratioDen, c);
    push({ kind: comp.kind, category: comp.category, code: comp.code, label: comp.label, quantity: null, rate: comp.calc_type === "percent_of_basic" ? `${comp.value}%` : null, amount, taxable: comp.taxable, source_type: "salary_component", source_id: comp.source_id });
  }

  // Daily and hourly rates derive from the basic salary.
  const dailyRate = periodDays ? mulDiv(basic, BigInt(1), BigInt(periodDays), c) : ZERO;
  const hours = input.policy.overtime.standard_monthly_hours;
  const minuteRateDen = milli(hours) * BigInt(60); // basic / (hours·60)

  if (input.policy.absence_deduction && input.absent_days > 0) {
    push({ kind: "deduction", category: "absence", code: "absence", label: `غياب (${input.absent_days} يوم)`, quantity: input.absent_days, rate: fmt(dailyRate), amount: mulDiv(dailyRate, milli(input.absent_days), THOUSAND, c), taxable: true, source_type: "attendance", source_id: null });
  }
  if (input.policy.unpaid_leave_deduction && input.unpaid_leave_days > 0) {
    push({ kind: "deduction", category: "unpaid_leave", code: "unpaid_leave", label: `إجازة بدون أجر (${input.unpaid_leave_days} يوم)`, quantity: input.unpaid_leave_days, rate: fmt(dailyRate), amount: mulDiv(dailyRate, milli(input.unpaid_leave_days), THOUSAND, c), taxable: true, source_type: "leave", source_id: null });
  }
  if (input.policy.late_deduction === "per_minute") {
    const billable = Math.max(0, input.late_minutes - input.policy.late_grace_minutes_per_month);
    if (billable > 0) {
      push({ kind: "deduction", category: "late", code: "late", label: `تأخير (${billable} دقيقة بعد السماح)`, quantity: billable, rate: null, amount: mulDiv(basic, milli(billable), minuteRateDen, c), taxable: true, source_type: "attendance", source_id: null });
    }
  }

  for (const ot of input.overtime) {
    // basic / hours × (minutes / 60) × multiplier
    const amount = mulDiv(basic, milli(ot.minutes) * milli(ot.multiplier), minuteRateDen * THOUSAND, c);
    push({ kind: "earning", category: "overtime", code: "overtime", label: ot.label, quantity: Math.round((ot.minutes / 60) * 100) / 100, rate: `×${ot.multiplier}`, amount, taxable: true, source_type: ot.source_id ? "overtime_request" : "attendance", source_id: ot.source_id });
  }
  for (const b of input.bonuses) push({ kind: "earning", category: "bonus", code: "bonus", label: b.label, quantity: null, rate: null, amount: money(b.amount), taxable: true, source_type: "employee_bonus", source_id: b.source_id });
  for (const cm of input.commissions) push({ kind: "earning", category: "commission", code: "commission", label: cm.label, quantity: null, rate: null, amount: money(cm.amount), taxable: true, source_type: "commission", source_id: cm.source_id });
  for (const m of input.manual) push({ kind: m.kind, category: m.kind === "earning" ? "other_earning" : "other_deduction", code: "manual", label: m.label, quantity: null, rate: null, amount: money(m.amount), taxable: m.taxable, source_type: "manual", source_id: null });

  // Totals so far (before statutory deductions and non-taxable items).
  const sum = (kind: "earning" | "deduction", pred: (l: PayrollLine) => boolean = () => true) => lines.filter((l) => l.kind === kind && pred(l)).reduce((s, l) => s + money(l.amount), ZERO);
  const taxableEarnings = sum("earning", (l) => l.taxable);
  const taxableReductions = sum("deduction", (l) => l.taxable);
  const grossBeforeReimb = sum("earning");

  if (input.policy.insurance.enabled) {
    const base = input.policy.insurance.basis === "gross" ? grossBeforeReimb - taxableReductions : earnedBasic;
    let ins = mulDiv(base > ZERO ? base : ZERO, milli(input.policy.insurance.employee_percent), BigInt(100) * THOUSAND, c);
    if (input.policy.insurance.cap_monthly !== null && ins > money(input.policy.insurance.cap_monthly)) ins = money(input.policy.insurance.cap_monthly);
    push({ kind: "deduction", category: "insurance", code: "insurance", label: `تأمينات اجتماعية (${input.policy.insurance.employee_percent}%)`, quantity: null, rate: `${input.policy.insurance.employee_percent}%`, amount: ins, taxable: false, source_type: "policy", source_id: null });
  }
  const insurance = sum("deduction", (l) => l.category === "insurance");
  let taxable = taxableEarnings - taxableReductions - insurance;
  if (taxable < ZERO) taxable = ZERO;
  const tax = progressiveTax(taxable, input.policy.tax, c);
  push({ kind: "deduction", category: "tax", code: "tax", label: "ضريبة كسب العمل", quantity: null, rate: null, amount: tax, taxable: false, source_type: "policy", source_id: null });

  // Non-taxable: reimbursements (earning) and loan/advance installments.
  for (const r of input.reimbursements) push({ kind: "earning", category: "reimbursement", code: "reimbursement", label: r.label, quantity: null, rate: null, amount: money(r.amount), taxable: false, source_type: "expense", source_id: r.source_id });
  for (const i of input.installments) push({ kind: "deduction", category: i.loan_type, code: i.loan_type, label: i.label, quantity: null, rate: null, amount: money(i.amount), taxable: false, source_type: "loan_installment", source_id: i.source_id });

  const totalEarnings = sum("earning");
  const totalDeductions = sum("deduction");
  const net = totalEarnings - totalDeductions;
  if (net < ZERO) warnings.push("صافي الراتب سالب — راجع الاستقطاعات والأقساط قبل الاعتماد.");
  if (basic === ZERO) warnings.push("لا يوجد راتب أساسي معتمد لهذه الفترة.");

  return {
    lines,
    basic_salary: fmt(basic),
    total_earnings: fmt(totalEarnings),
    total_deductions: fmt(totalDeductions),
    gross_pay: fmt(totalEarnings),
    taxable_pay: fmt(taxable),
    net_pay: fmt(net),
    paid_days: employedDays,
    warnings,
  };
}
