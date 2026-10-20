import { z } from "zod";
import { FIELDS, OPS, fieldDef } from "./catalog";

// Rules on user facts (segments, flow entry, branches, exits). All rules in a
// list must hold. Shared by the engine and Yolias Admin: no "@/" imports.

export const ruleSchema = z.object({
  field: z.string().min(1).max(60),
  op: z.enum(["is", "is_not", "in", "not_in", "gt", "gte", "lt", "lte", "contains", "exists", "not_exists"]),
  value: z.union([z.boolean(), z.number(), z.string().max(200), z.array(z.string().max(60)).max(20)]).optional(),
});
export const rulesSchema = z.array(ruleSchema).max(20);
export type Rule = z.infer<typeof ruleSchema>;

/** The facts of one user (public.msg_user_facts), as the engine loads them. */
export interface FactsRow {
  user_id: string; email: string; full_name: string | null; language: string | null; country: string | null; timezone: string | null;
  created_at: string; onboarded_at: string | null; marketing_opt_in: boolean; unsubscribed: boolean; suppressed: boolean; email_token: string;
  workspace_id: string | null; workspace_name: string | null; role: string | null; plan: string | null; subscription_status: string | null;
  billing_period: string | null; trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean | null;
  searches: number; prospects: number; last_seen_at: string | null; open_checkout: boolean; checkout_plan: string | null; failed_payments_7d: number; banned: boolean;
}

export interface EventLike { plan?: string | null; props?: Record<string, unknown> | null }

const DAY = 86_400_000;

/** A fact by field id, computed from the row (and the event for "event.*"). */
export function factValue(field: string, f: FactsRow, ev?: EventLike | null, now = Date.now()): unknown {
  if (field.startsWith("event.")) {
    const k = field.slice(6);
    if (k === "plan") return ev?.plan ?? (ev?.props?.plan as string | undefined) ?? null;
    return ev?.props?.[k] ?? null;
  }
  switch (field) {
    case "has_plan": return ["active", "test", "trialing"].includes(f.subscription_status ?? "none");
    case "subscription_status": return f.subscription_status ?? "none";
    case "plan": return f.plan ?? "free";
    case "billing_period": return f.billing_period;
    case "cancel_at_period_end": return Boolean(f.cancel_at_period_end);
    case "trial_days_left": return f.subscription_status === "trialing" && f.trial_ends_at ? Math.max(0, Math.ceil((Date.parse(f.trial_ends_at) - now) / DAY)) : null;
    case "open_checkout": return f.open_checkout;
    case "failed_payments_7d": return f.failed_payments_7d;
    case "days_since_signup": return Math.floor((now - Date.parse(f.created_at)) / DAY);
    case "days_inactive": return Math.floor((now - Date.parse(f.last_seen_at ?? f.created_at)) / DAY);
    case "onboarded": return Boolean(f.onboarded_at);
    case "searches": return f.searches;
    case "prospects": return Number(f.prospects);
    case "language": return f.language === "ar" ? "ar" : "en";
    case "country": return f.country;
    case "role": return f.role;
    case "marketing_opt_in": return f.marketing_opt_in;
    default: return undefined;
  }
}

export function ruleHolds(r: Rule, f: FactsRow, ev?: EventLike | null, now = Date.now()): boolean {
  const v = factValue(r.field, f, ev, now);
  const want = r.value;
  switch (r.op) {
    case "exists": return v !== null && v !== undefined && v !== "";
    case "not_exists": return v === null || v === undefined || v === "";
    case "is": return typeof want === "number" ? Number(v) === want : typeof want === "string" ? String(v ?? "").toLowerCase() === want.toLowerCase() : v === want;
    case "is_not": return typeof want === "string" ? String(v ?? "").toLowerCase() !== want.toLowerCase() : v !== want;
    case "in": return Array.isArray(want) && want.includes(String(v));
    case "not_in": return Array.isArray(want) && !want.includes(String(v));
    case "contains": return typeof want === "string" && String(v ?? "").toLowerCase().includes(want.toLowerCase());
    case "gt": return v != null && Number(v) > Number(want);
    case "gte": return v != null && Number(v) >= Number(want);
    case "lt": return v != null && Number(v) < Number(want);
    case "lte": return v != null && Number(v) <= Number(want);
  }
}

/** The first rule that doesn't hold (null = all hold). */
export function firstFailing(rules: Rule[], f: FactsRow, ev?: EventLike | null, now = Date.now()): Rule | null {
  return rules.find((r) => !ruleHolds(r, f, ev, now)) ?? null;
}

/** Problems with a rule list, in Arabic, for Admin forms (empty = valid). */
export function ruleErrors(raw: unknown): string[] {
  const parsed = rulesSchema.safeParse(raw);
  if (!parsed.success) return ["صيغة الشروط غير صالحة."];
  const out: string[] = [];
  for (const r of parsed.data) {
    const def = fieldDef(r.field);
    if (!def) { out.push(`حقل غير معروف: ${r.field}`); continue; }
    if (!OPS[def.type].some((o) => o.value === r.op)) out.push(`العملية غير مناسبة للحقل «${def.label}».`);
    if (r.op === "exists" || r.op === "not_exists") continue;
    if (def.type === "bool" && typeof r.value !== "boolean") out.push(`«${def.label}»: اختر نعم أو لا.`);
    if (def.type === "number" && (typeof r.value !== "number" || !Number.isFinite(r.value))) out.push(`«${def.label}»: أدخل رقمًا.`);
    if (def.type === "enum" && (!Array.isArray(r.value) || !r.value.length || r.value.some((x) => !def.options?.some((o) => o.value === x)))) out.push(`«${def.label}»: اختر قيمة واحدة على الأقل.`);
    if (def.type === "text" && (typeof r.value !== "string" || !r.value.trim())) out.push(`«${def.label}»: أدخل قيمة.`);
  }
  return out;
}

/** A readable sentence for a rule (Admin lists and logs). */
export function describeRule(r: Rule): string {
  const def = fieldDef(r.field);
  const label = def?.label ?? r.field;
  const val = Array.isArray(r.value)
    ? r.value.map((x) => def?.options?.find((o) => o.value === x)?.label ?? x).join("، ")
    : typeof r.value === "boolean" ? (r.value ? "نعم" : "لا") : String(r.value ?? "");
  const op = FIELDS.length && def ? OPS[def.type].find((o) => o.value === r.op)?.label ?? r.op : r.op;
  return r.op === "exists" || r.op === "not_exists" ? `${label} ${op}` : `${label} ${op} ${val}`;
}
