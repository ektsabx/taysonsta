import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePayslip, progressiveTax, type PayrollInput } from "@/lib/bos/payroll-calc";

const policy: PayrollInput["policy"] = {
  working_days_basis: "schedule",
  absence_deduction: true,
  unpaid_leave_deduction: true,
  late_deduction: "none",
  late_grace_minutes_per_month: 60,
  overtime: { standard_monthly_hours: 176 },
  tax: { enabled: false, exemption_monthly: 0, brackets: [{ up_to: null, rate: 0 }] },
  insurance: { enabled: false, employee_percent: 11, basis: "basic", cap_monthly: null },
};

function base(over: Partial<PayrollInput> = {}): PayrollInput {
  return {
    currency: "EGP",
    basic: "22000",
    components: [],
    period_working_days: 22,
    employed_working_days: 22,
    period_calendar_days: 30,
    employed_calendar_days: 30,
    absent_days: 0,
    unpaid_leave_days: 0,
    late_minutes: 0,
    overtime: [],
    bonuses: [],
    commissions: [],
    reimbursements: [],
    installments: [],
    manual: [],
    policy,
    ...over,
  };
}

test("full month: basic + fixed and percentage components", () => {
  const r = calculatePayslip(base({
    components: [
      { code: "housing", label: "بدل سكن", kind: "earning", category: "housing", calc_type: "percent_of_basic", value: "10", taxable: true, source_id: "c1" },
      { code: "transportation", label: "بدل انتقال", kind: "earning", category: "transportation", calc_type: "fixed", value: "1500", taxable: true, source_id: "c2" },
    ],
  }));
  assert.equal(r.total_earnings, "25700.00");
  assert.equal(r.net_pay, "25700.00");
  assert.deepEqual(r.warnings, []);
});

test("loan installment 3,000/month and absence at the daily rate", () => {
  const r = calculatePayslip(base({
    absent_days: 1,
    installments: [{ source_id: "i1", label: "قسط قرض 1/10", amount: "3000", loan_type: "loan" }],
  }));
  // daily rate = 22000 / 22 = 1000
  assert.equal(r.lines.find((l) => l.category === "absence")?.amount, "1000.00");
  assert.equal(r.lines.find((l) => l.category === "loan")?.amount, "3000.00");
  assert.equal(r.net_pay, "18000.00");
});

test("overtime = basic / monthly hours × hours × multiplier", () => {
  // 17600 / 176 = 100/h → 90 min × 1.5 = 225
  const r = calculatePayslip(base({ basic: "17600", overtime: [{ source_id: "o1", minutes: 90, multiplier: 1.5, label: "عمل إضافي" }] }));
  assert.equal(r.lines.find((l) => l.category === "overtime")?.amount, "225.00");
  assert.equal(r.gross_pay, "17825.00");
});

test("bonus, commission, reimbursement (non-taxable) and proration for a mid-month joiner", () => {
  const r = calculatePayslip(base({
    employed_working_days: 11,
    bonuses: [{ source_id: "b1", label: "مكافأة أداء", amount: "2000" }],
    commissions: [{ source_id: "k1", label: "عمولة", amount: "500" }],
    reimbursements: [{ source_id: "e1", label: "استرداد مصروف", amount: "300" }],
  }));
  assert.equal(r.lines.find((l) => l.category === "basic")?.amount, "11000.00");
  assert.equal(r.total_earnings, "13800.00");
  assert.equal(r.taxable_pay, "13500.00");
});

test("progressive tax with exemption and insurance on basic", () => {
  const tax = { enabled: true, exemption_monthly: 1000, brackets: [{ up_to: 5000, rate: 0 }, { up_to: 10000, rate: 10 }, { up_to: null, rate: 20 }] };
  // taxable 21000 - 1000 = 20000 → 5000×0 + 5000×10% + 10000×20% = 2500
  assert.equal(String(progressiveTax(BigInt(21000000), tax, "EGP")), "2500000");
  const r = calculatePayslip(base({ basic: "20000", policy: { ...policy, tax, insurance: { enabled: true, employee_percent: 11, basis: "basic", cap_monthly: null } } }));
  // insurance 2200; taxable 17800 - 1000 = 16800 → 500 + 6800×20% = 1860
  assert.equal(r.lines.find((l) => l.category === "insurance")?.amount, "2200.00");
  assert.equal(r.lines.find((l) => l.category === "tax")?.amount, "1860.00");
  assert.equal(r.net_pay, "15940.00");
});

test("negative net is flagged", () => {
  const r = calculatePayslip(base({ basic: "1000", installments: [{ source_id: "i", label: "سلفة", amount: "5000", loan_type: "advance" }] }));
  assert.ok(r.warnings.some((w) => w.includes("سالب")));
});
