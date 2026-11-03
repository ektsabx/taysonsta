import { z } from "zod";

// Onboarding pages, edited in Yolias Admin → Onboarding (owner, 2026-11-03,
// D-276; site_settings "yolias_onboarding", read on each request). Each step
// is one page. Two are built in: "company" (the website and the company
// profile Yolias works from; always on and always first) and "source" (How
// did you find us?). The owner can add his own steps with his own questions;
// the answers are kept on the account (profiles.onboarding_answers) and shown
// in Admin. Shared by Yolias and the Admin: relative imports only.
export const ONBOARDING_KEY = "yolias_onboarding";

const text = (max: number) => z.string().trim().max(max);
const localized = (max: number) => z.object({ ar: text(max).catch(""), en: text(max).catch("") });

export const FIELD_TYPES = ["text", "textarea", "select", "multi"] as const;
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: localized(160),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().catch(false),
  options: z.array(localized(120)).max(30).catch([]),
});
export type OnboardingField = z.infer<typeof fieldSchema>;

export const stepSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  kind: z.enum(["company", "source", "custom"]),
  enabled: z.boolean().catch(true),
  title: localized(160),
  lead: localized(400),
  fields: z.array(fieldSchema).max(12).catch([]),
});
export type OnboardingStep = z.infer<typeof stepSchema>;

export const DEFAULT_STEPS: OnboardingStep[] = [
  { id: "company", kind: "company", enabled: true, title: { ar: "", en: "" }, lead: { ar: "", en: "" }, fields: [] },
  { id: "source", kind: "source", enabled: true, title: { ar: "", en: "" }, lead: { ar: "", en: "" }, fields: [] },
];

/** The steps to show: the company step always first and on; unknown or broken steps are dropped. */
export function parseSteps(value: unknown): OnboardingStep[] {
  const raw = (value as { steps?: unknown } | null)?.steps;
  const list = Array.isArray(raw) ? raw.map((s) => stepSchema.safeParse(s)).filter((r) => r.success).map((r) => r.data!) : [];
  const steps = list.length ? list : DEFAULT_STEPS;
  const company = steps.find((s) => s.kind === "company") ?? DEFAULT_STEPS[0];
  const rest = steps.filter((s) => s.kind !== "company" && !(s.kind === "source" && steps.filter((x) => x.kind === "source").indexOf(s) > 0));
  const ids = new Set<string>();
  return [{ ...company, enabled: true }, ...rest].filter((s) => (ids.has(s.id) ? false : (ids.add(s.id), true)));
}

/** A custom step's answers from the submitted form: only its own fields, trimmed, limited. */
export function answersOf(steps: OnboardingStep[], get: (name: string) => string[]): { answers: Record<string, Record<string, string | string[]>>; missing: string | null } {
  const answers: Record<string, Record<string, string | string[]>> = {};
  let missing: string | null = null;
  for (const s of steps) {
    if (s.kind !== "custom" || !s.enabled) continue;
    const a: Record<string, string | string[]> = {};
    for (const f of s.fields) {
      const name = `q_${s.id}_${f.key}`;
      const values = get(name).map((v) => v.trim().slice(0, f.type === "textarea" ? 2000 : 300)).filter(Boolean);
      const allowed = (v: string) => f.type !== "select" && f.type !== "multi" ? true : f.options.some((o) => o.ar === v || o.en === v);
      const ok = values.filter(allowed);
      if (f.type === "multi") { if (ok.length) a[f.key] = ok.slice(0, 30); }
      else if (ok[0]) a[f.key] = ok[0];
      if (f.required && !a[f.key] && !missing) missing = f.label.ar || f.label.en || f.key;
    }
    if (Object.keys(a).length) answers[s.id] = a;
  }
  return { answers, missing };
}
