import type { PermissionKey } from "@/lib/bos/permissions";

// Settings sections delegated to non-admin roles (docs/bos/22 "Users"):
// HR → attendance, Finance → commission/currencies, Sales Manager →
// pipeline (when granted leads.manage). settings.manage always works.
export const sectionDelegates: Record<string, PermissionKey> = {
  attendance: "attendance.manage",
  hr: "attendance.manage",
  payroll: "payroll.manage",
  commission: "commissions.manage",
  pricing: "invoices.manage",
  pipeline: "leads.manage",
};

export const tableSection: Record<string, string> = {
  work_schedules: "attendance", holidays: "attendance", leave_types: "attendance",
  employee_categories: "hr", document_types: "hr", hr_request_types: "hr", departments: "hr", teams: "hr",
  salary_components: "payroll",
  commission_rules: "commission",
  currencies: "pricing", exchange_rates: "pricing",
  lead_sources: "pipeline",
};

export const settingKeySection: Record<string, string> = {
  attendance_policy: "attendance",
  payroll_policy: "payroll",
  lead_routing: "pipeline",
};
