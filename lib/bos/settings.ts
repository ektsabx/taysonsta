import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { z } from "zod";
import type { Json } from "@/types/database";
import { db } from "@/lib/bos/db";

// Business rules live in bos_settings, never in code (§108). Each key has a
// schema with defaults so a missing/partial row never breaks the app.

const optionalText = (max = 500) => z.string().trim().max(max).default("");
export const brandFontsAr = ["IBM Plex Sans Arabic", "Cairo", "Tajawal", "Almarai", "Noto Sans Arabic", "Readex Pro"] as const;
export const brandFontsEn = ["Inter", "Roboto", "Poppins", "Manrope", "IBM Plex Sans"] as const;
const hexColor = z.string().regex(/^#([0-9a-fA-F]{6})$/, "لون غير صالح (#RRGGBB)");
const socialSchema = z.object({
  facebook: optionalText(), instagram: optionalText(), linkedin: optionalText(), x: optionalText(), youtube: optionalText(),
  tiktok: optionalText(), snapchat: optionalText(), threads: optionalText(), telegram: optionalText(), whatsapp: optionalText(),
}).partial().default({});

// Company & System Settings (docs/bos/30 §3.1): the single source of company
// data for every module, document and email. Empty values are allowed —
// never invented.
const companySchema = z.object({
  name: z.string().default("Taysonsta"),
  legal_name: optionalText(),
  trade_name: optionalText(),
  description: optionalText(2000),
  logo_path: z.string().nullable().default(null),
  icon_path: z.string().nullable().default(null),
  brand_primary: hexColor.default("#e51f26"),
  // Secondary colour (docs/bos/35 B3).
  brand_accent: hexColor.default("#60a5fa"),
  // Status colours; "" keeps the theme default (tuned for light/dark contrast).
  brand_success: z.union([hexColor, z.literal("")]).default(""),
  brand_warning: z.union([hexColor, z.literal("")]).default(""),
  brand_danger: z.union([hexColor, z.literal("")]).default(""),
  brand_info: z.union([hexColor, z.literal("")]).default(""),
  brand_font_ar: z.enum(brandFontsAr).default("IBM Plex Sans Arabic"),
  brand_font_en: z.enum(brandFontsEn).default("Inter"),
  website: optionalText(),
  address: z.string().default(""),
  country: optionalText(100),
  region: optionalText(100),
  city: optionalText(100),
  postal_code: optionalText(20),
  commercial_registration: optionalText(100),
  contact_email: z.string().default(""),
  contact_phone: z.string().default(""),
  tax_id: z.string().default(""),
  base_currency: z.string().length(3).default("USD"),
  timezone: z.string().default("Africa/Cairo"),
  email_domain: z.string().default("taysonsta.com"),
  // Kept for stored data only: Arabic and English are both always available (docs/bos/35 A5).
  enabled_languages: z.array(z.enum(["ar", "en"])).min(1).default(["ar", "en"]),
  default_language: z.enum(["ar", "en"]).default("ar"),
  default_theme: z.enum(["dark", "light", "system"]).default("system"),
  date_format: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "d MMM yyyy"]).default("d MMM yyyy"),
  time_format: z.enum(["24h", "12h"]).default("24h"),
  number_locale: z.enum(["en-US", "ar-EG", "ar-SA"]).default("en-US"),
  week_start: z.coerce.number().int().min(0).max(6).default(6),
  social: socialSchema,
});

const salesSchema = z.object({
  qualified_min_score: z.coerce.number().int().min(0).max(100).default(50),
  require_payment_terms_for_won: z.boolean().default(true),
  require_signed_contract_for_won: z.boolean().default(false),
  deal_won_requires_approval: z.boolean().default(false),
});

const deliverySchema = z.object({
  pm_assignment: z.enum(["round_robin", "least_loaded", "specific", "manual"]).default("round_robin"),
  pm_user_id: z.string().uuid().nullable().default(null),
  senior_pm_user_ids: z.array(z.string().uuid()).default([]),
  support_period_days: z.coerce.number().int().min(0).max(3650).default(30),
});

const projectCompletionSchema = z.object({
  allow_complete_with_pending_payment: z.boolean().default(false),
  allow_complete_with_pending_approvals: z.boolean().default(false),
});

const financeSchema = z.object({
  auto_send_first_invoice: z.boolean().default(false),
  allow_overpayment: z.boolean().default(false),
  default_payment_due_days: z.coerce.number().int().min(0).max(365).default(7),
  profitability_revenue_basis: z.enum(["collected", "invoiced"]).default("collected"),
});

const attendancePolicySchema = z.object({
  forgotten_clock_out: z
    .object({
      auto_close_at_schedule_end: z.boolean().default(true),
      require_employee_correction: z.boolean().default(true),
      notify_employee: z.boolean().default(true),
      notify_manager: z.boolean().default(true),
      mark_requires_review: z.boolean().default(true),
    })
    .default({
      auto_close_at_schedule_end: true,
      require_employee_correction: true,
      notify_employee: true,
      notify_manager: true,
      mark_requires_review: true,
    }),
  auto_close_after_minutes: z.coerce.number().int().min(0).max(1440).default(120),
  expected_includes_break: z.boolean().default(true),
  deduct_scheduled_break: z.boolean().default(false),
  reminder_after_minutes: z.coerce.number().int().min(0).max(600).default(30),
  lock_before_date: z.string().nullable().default(null),
  // "after_schedule_end": overtime = clock-out after the scheduled end
  // (docs/bos/28 §11 example); "worked_beyond_expected": total worked − expected.
  overtime_basis: z.enum(["after_schedule_end", "worked_beyond_expected"]).default("after_schedule_end"),
});

const stepsSchema = (steps: string[]) => z.object({ steps: z.array(z.string()).min(1) }).default({ steps });

// Payroll rules incl. overtime rules (docs/bos/28 §15–17). Tax brackets are
// progressive on monthly taxable pay after the exemption; configure them per
// country law.
// Unified approvals (docs/bos/30 §18): decision SLA, reminders, escalation
// to the approver's manager, and amount thresholds that add steps (the
// source passes the amount in base currency as payload.amount_base).
const approvalWorkflowSchema = z.object({
  sla_hours: z.coerce.number().int().min(1).max(720).default(48),
  remind_every_hours: z.coerce.number().int().min(1).max(168).default(24),
  escalate_after_hours: z.coerce.number().int().min(0).max(1440).default(96),
  thresholds: z
    .array(z.object({ approval_type: z.string().min(1), min_amount: z.coerce.number().min(0), add_steps: z.array(z.string().min(1)).min(1) }))
    .default([]),
});

// Unified AI client (docs/bos/30 §7): provider order for fallback, monthly
// budget (0 = no limit) and prices used for cost estimates (USD per 1M
// tokens) — cost is only shown for models with a configured price.
// Advertising analytics (docs/bos/30 §14): which Meta action types count as
// conversions (avoid overlapping types such as "purchase" + pixel purchase),
// and how many recent days each sync re-reads (late-attributed conversions).
// Deal Radar (docs/bos/30 §17): what counts as "near closing", "no recent
// activity", the value above which risky deals need a manager (0 = top 25%),
// and how many closed deals are needed before historic win rates are used.
// Time tracking (docs/bos/30 §22): which entries need a manager's approval
// before they count in reports and costs — none, manual entries only, or all.
// Employee location (docs/bos/30 §28): off by default; captured only at work
// events the employee performs, with their consent to the purpose text below.
// Changing the purpose bumps the version and asks everyone to consent again.
const locationSchema = z.object({
  enabled: z.coerce.boolean().default(false),
  purpose_text: z.string().max(2000).default("نستخدم موقعك عند تسجيل الحضور والانصراف فقط للتحقق من الحضور في موقع العمل أو الفرع. لا يتم تتبعك بشكل مستمر، ويمكنك سحب موافقتك في أي وقت."),
  purpose_version: z.coerce.number().int().min(1).default(1),
  retention_days: z.coerce.number().int().min(7).max(730).default(90),
  allow_task_checkins: z.coerce.boolean().default(false),
});

const timeTrackingSchema = z.object({
  approval: z.enum(["none", "manual", "all"]).default("none"),
});

const dealRadarSchema = z.object({
  horizon_days: z.coerce.number().int().min(1).max(180).default(30),
  inactivity_days: z.coerce.number().int().min(1).max(90).default(14),
  min_probability: z.coerce.number().min(0).max(100).default(40),
  intervention_value: z.coerce.number().min(0).default(0),
  min_history: z.coerce.number().int().min(5).max(1000).default(20),
});

const adsSchema = z.object({
  meta_conversion_types: z.array(z.string().min(1).max(80)).max(20).default(["purchase", "lead"]),
  sync_days_back: z.coerce.number().int().min(1).max(30).default(3),
});

const aiSchema = z.object({
  fallback_order: z.array(z.enum(["anthropic", "openai", "gemini"])).default(["anthropic", "openai", "gemini"]),
  monthly_budget_usd: z.coerce.number().min(0).max(1_000_000).default(0),
  prices: z
    .array(z.object({ model: z.string().trim().min(1).max(100), input_per_mtok: z.coerce.number().min(0), output_per_mtok: z.coerce.number().min(0) }))
    .default([]),
});

const payrollPolicySchema = z.object({
  working_days_basis: z.enum(["schedule", "fixed_30"]).default("schedule"),
  absence_deduction: z.boolean().default(true),
  unpaid_leave_deduction: z.boolean().default(true),
  late_deduction: z.enum(["none", "per_minute"]).default("none"),
  late_grace_minutes_per_month: z.coerce.number().int().min(0).max(10000).default(60),
  include_commissions: z.boolean().default(true),
  include_reimbursements: z.boolean().default(true),
  overtime: z
    .object({
      source: z.enum(["approved_requests", "attendance"]).default("approved_requests"),
      standard_monthly_hours: z.coerce.number().min(1).max(400).default(176),
      workday_multiplier: z.coerce.number().min(0).max(10).default(1.5),
      day_off_multiplier: z.coerce.number().min(0).max(10).default(2),
      holiday_multiplier: z.coerce.number().min(0).max(10).default(2),
    })
    .default({ source: "approved_requests", standard_monthly_hours: 176, workday_multiplier: 1.5, day_off_multiplier: 2, holiday_multiplier: 2 }),
  tax: z
    .object({
      enabled: z.boolean().default(false),
      exemption_monthly: z.coerce.number().min(0).default(0),
      brackets: z.array(z.object({ up_to: z.coerce.number().min(0).nullable(), rate: z.coerce.number().min(0).max(100) })).default([{ up_to: null, rate: 0 }]),
    })
    .default({ enabled: false, exemption_monthly: 0, brackets: [{ up_to: null, rate: 0 }] }),
  insurance: z
    .object({
      enabled: z.boolean().default(false),
      employee_percent: z.coerce.number().min(0).max(100).default(11),
      basis: z.enum(["basic", "gross"]).default("basic"),
      cap_monthly: z.coerce.number().min(0).nullable().default(null),
    })
    .default({ enabled: false, employee_percent: 11, basis: "basic", cap_monthly: null }),
  salary_expense_category: z.string().default("الرواتب والأجور"),
});

const contractsSchema = z.object({ store_signer_ip: z.boolean().default(true) });

const securitySchema = z.object({
  password_min_length: z.coerce.number().int().min(8).max(128).default(10),
  session_timeout_minutes: z.coerce.number().int().min(15).max(43200).default(720),
  require_2fa_role_keys: z.array(z.string()).default(["super_admin", "admin", "finance"]),
  login_max_attempts: z.coerce.number().int().min(3).max(50).default(5),
  login_window_minutes: z.coerce.number().int().min(1).max(1440).default(15),
  // Google sign-in (docs/bos/30 §6): only for existing active employees; the
  // OAuth client itself is configured in Supabase Auth, never stored here.
  google_sign_in: z.boolean().default(false),
  google_allowed_domains: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).default([]),
});

// Page-level restrictions on top of module permissions (docs/bos/30 §6):
// a path prefix limited to the listed roles (super admin always passes).
const pageAccessSchema = z.object({
  rules: z
    .array(z.object({ prefix: z.string().regex(/^\/admin\/[a-z0-9\-/]+$/), role_keys: z.array(z.string()).min(1), note: z.string().max(200).default("") }))
    .default([]),
});

const notificationsSchema = z.object({
  meeting_reminder_minutes: z.coerce.number().int().min(0).max(1440).default(30),
  followup_reminder_minutes: z.coerce.number().int().min(0).max(1440).default(60),
  overdue_escalation_days: z.coerce.number().int().min(0).max(60).default(2),
});

const integrationToggle = z.object({ enabled: z.boolean().default(false) }).passthrough();

const integrationsSchema = z.object({
  email: z
    .object({ enabled: z.boolean().default(false), provider: z.string().nullable().default(null), from: z.string().nullable().default(null) })
    .default({ enabled: false, provider: null, from: null }),
  calendar: integrationToggle.default({ enabled: false }),
  payment: integrationToggle.default({ enabled: false }),
  esign: integrationToggle.default({ enabled: false }),
  whatsapp: integrationToggle.default({ enabled: false }),
  scheduler: integrationToggle.default({ enabled: false }),
  push: integrationToggle.default({ enabled: false }),
  webhooks: z
    .object({ enabled: z.boolean().default(false), allowed_domains: z.array(z.string()).default([]) })
    .default({ enabled: false, allowed_domains: [] }),
});

const leadRoutingSchema = z.object({
  strategy: z.enum(["round_robin", "least_loaded", "manual"]).default("round_robin"),
  role_key: z.string().default("business_development"),
  last_user_id: z.string().uuid().nullable().default(null),
});

const approverSchema = z.object({ required: z.boolean().default(true), approver: z.string().default("manager") });
const approvalPoliciesSchema = z.object({
  proposal: approverSchema.default({ required: false, approver: "role:sales_manager" }),
  expense: approverSchema.default({ required: true, approver: "manager" }),
  leave: approverSchema.default({ required: true, approver: "manager" }),
  attendance_correction: approverSchema.default({ required: true, approver: "manager" }),
  overtime: approverSchema.default({ required: true, approver: "manager" }),
  invoice: approverSchema.default({ required: false, approver: "role:finance" }),
  access_request: z.object({ steps: z.array(z.string()).min(1) }).default({ steps: ["manager", "role:admin"] }),
  access_request_sensitive: z.object({ steps: z.array(z.string()).min(1) }).default({ steps: ["manager", "role:super_admin"] }),
  // HR & Workforce (docs/bos/28 §14–19, §22, §25)
  payroll: stepsSchema(["role:finance"]),
  loan: stepsSchema(["manager", "role:hr", "role:finance"]),
  advance: stepsSchema(["manager", "role:finance"]),
  bonus: stepsSchema(["role:finance"]),
  employee_expense: stepsSchema(["manager", "role:finance"]),
  salary_adjustment: stepsSchema(["role:finance"]),
  job_offer: z.object({ required: z.boolean().default(false), steps: z.array(z.string()).min(1) }).default({ required: false, steps: ["role:hr"] }),
});

export const settingSchemas = {
  company: companySchema,
  sales: salesSchema,
  delivery: deliverySchema,
  project_completion: projectCompletionSchema,
  finance: financeSchema,
  attendance_policy: attendancePolicySchema,
  contracts: contractsSchema,
  security: securitySchema,
  page_access: pageAccessSchema,
  notifications: notificationsSchema,
  integrations: integrationsSchema,
  lead_routing: leadRoutingSchema,
  approval_policies: approvalPoliciesSchema,
  payroll_policy: payrollPolicySchema,
  ai: aiSchema,
  approval_workflow: approvalWorkflowSchema,
  ads: adsSchema,
  deal_radar: dealRadarSchema,
  time_tracking: timeTrackingSchema,
  location: locationSchema,
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const { data } = await db().from("bos_settings").select("value").eq("key", key).maybeSingle();
  const parsed = settingSchemas[key].safeParse(data?.value ?? {});
  if (parsed.success) return parsed.data as SettingValue<K>;
  return settingSchemas[key].parse({}) as SettingValue<K>;
}

export async function saveSetting<K extends SettingKey>(key: K, value: unknown, actorId: string): Promise<{ before: unknown; after: SettingValue<K> }> {
  const after = settingSchemas[key].parse(value) as SettingValue<K>;
  const { data: current } = await db().from("bos_settings").select("value").eq("key", key).maybeSingle();
  const { error } = await db()
    .from("bos_settings")
    .upsert({ key, value: after as unknown as Json, updated_by: actorId, updated_at: nowIso() });
  if (error) throw error;
  return { before: current?.value ?? null, after };
}
