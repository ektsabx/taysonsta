import { z } from "zod";
import { eventDef } from "./catalog";
import { ruleErrors, rulesSchema } from "./rules";

// A flow (automation or sequence) is a list of steps run in order. A branch
// jumps forward to another step, or ends the flow. Waits pause the run; every
// action re-checks the user's state first (engine). Shared by the engine and
// Yolias Admin: no "@/" imports.

const id = z.string().regex(/^[a-z0-9_-]{1,32}$/);
export const stepSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("email"), template_id: z.string().uuid() }),
  z.object({ id, type: z.literal("notification"), title: z.string().trim().min(2).max(200), body: z.string().trim().max(500).optional(), link: z.string().trim().max(300).optional() }),
  z.object({ id, type: z.literal("wait"), amount: z.number().int().min(1).max(525_600), unit: z.enum(["minutes", "hours", "days"]) }),
  z.object({ id, type: z.literal("branch"), rules: rulesSchema, yes: z.string().max(32), no: z.string().max(32) }),
  z.object({ id, type: z.literal("exit") }),
]);
export const stepsSchema = z.array(stepSchema).min(1).max(40);
export type Step = z.infer<typeof stepSchema>;

export const WAIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;
export const MAX_WAIT_MS = 400 * 86_400_000;

/** Where a branch goes: "next" (the following step), "end", or a later step id. */
export type Target = "next" | "end" | string;

/** The index of the step after `index`, following a branch result. -1 = end. */
export function nextIndex(steps: Step[], index: number, branch?: boolean): number {
  const s = steps[index];
  if (!s || s.type === "exit") return -1;
  if (s.type === "branch" && branch !== undefined) {
    const target = branch ? s.yes : s.no;
    if (target === "end") return -1;
    if (target === "next") return index + 1 < steps.length ? index + 1 : -1;
    const at = steps.findIndex((x) => x.id === target);
    return at > index ? at : -1;
  }
  return index + 1 < steps.length ? index + 1 : -1;
}

export interface FlowDefinition {
  kind: "automation" | "sequence";
  trigger_event: string;
  steps: unknown;
  entry_rules: unknown;
  exit_rules: unknown;
  exit_events: string[];
  goal_event: string | null;
  reentry: "never" | "after_exit" | "always";
  reentry_days: number | null;
  send_window: { start: number; end: number } | null;
}

/** Problems with a flow definition, in Arabic (empty = can be saved). `templates` = ids that exist and are active. */
export function flowErrors(d: FlowDefinition, templates: Set<string>): string[] {
  const out: string[] = [];
  const trig = eventDef(d.trigger_event);
  if (!trig || trig.available === false) out.push("اختر حدث البداية.");
  for (const e of d.exit_events) if (!eventDef(e)) out.push(`حدث خروج غير معروف: ${e}`);
  if (d.goal_event && !eventDef(d.goal_event)) out.push("حدث الهدف غير معروف.");
  out.push(...ruleErrors(d.entry_rules).map((x) => `شروط الدخول: ${x}`));
  out.push(...ruleErrors(d.exit_rules).map((x) => `شروط الخروج: ${x}`));
  if (d.reentry !== "never" && d.reentry_days != null && (d.reentry_days < 1 || d.reentry_days > 3650)) out.push("مدة إعادة الدخول بين 1 و3650 يومًا.");
  if (d.send_window && !(d.send_window.start >= 0 && d.send_window.end <= 24 && d.send_window.start < d.send_window.end)) out.push("ساعات الإرسال غير صالحة.");

  const parsed = stepsSchema.safeParse(d.steps);
  if (!parsed.success) {
    out.push(Array.isArray(d.steps) && d.steps.length === 0 ? "أضف خطوة واحدة على الأقل." : "خطوة غير مكتملة: راجع الحقول المطلوبة في كل خطوة.");
    return out;
  }
  const steps = parsed.data;
  const ids = new Set<string>();
  steps.forEach((s, i) => {
    const n = i + 1;
    if (ids.has(s.id)) out.push(`الخطوة ${n}: المعرّف «${s.id}» مكرر.`);
    if (s.id === "next" || s.id === "end") out.push(`الخطوة ${n}: «${s.id}» اسم محجوز، اختر معرّفًا آخر.`);
    ids.add(s.id);
    if (s.type === "email" && !templates.has(s.template_id)) out.push(`الخطوة ${n}: القالب غير موجود أو مؤرشف.`);
    if (s.type === "wait" && s.amount * WAIT_MS[s.unit] > MAX_WAIT_MS) out.push(`الخطوة ${n}: الانتظار أطول من 400 يوم.`);
    if (s.type === "branch") {
      out.push(...ruleErrors(s.rules).map((x) => `الخطوة ${n}: ${x}`));
      if (!s.rules.length) out.push(`الخطوة ${n}: أضف شرطًا للتفرّع.`);
      for (const t of [s.yes, s.no]) {
        if (t === "next" || t === "end") continue;
        const at = steps.findIndex((x) => x.id === t);
        if (at === -1) out.push(`الخطوة ${n}: الهدف «${t}» غير موجود.`);
        else if (at <= i) out.push(`الخطوة ${n}: التفرّع يجب أن يتجه إلى خطوة لاحقة (لا رجوع للخلف).`);
      }
    }
  });
  if (!steps.some((s) => s.type === "email" || s.type === "notification")) out.push("أضف خطوة إرسال (إيميل أو إشعار).");
  // A sequence is emails spaced by waits; an automation may act right away.
  if (d.kind === "sequence" && steps.filter((s) => s.type === "email").length < 1) out.push("التسلسل يحتاج إيميلًا واحدًا على الأقل.");
  return out;
}

/** Human summary of a step (Admin lists, logs). */
export function describeStep(s: Step, templateName: (id: string) => string): string {
  switch (s.type) {
    case "email": return `إيميل: ${templateName(s.template_id)}`;
    case "notification": return `إشعار: ${s.title}`;
    case "wait": return `انتظار ${s.amount} ${{ minutes: "دقيقة", hours: "ساعة", days: "يوم" }[s.unit]}`;
    case "branch": return `تفرّع: نعم ← ${s.yes === "next" ? "التالية" : s.yes === "end" ? "إنهاء" : s.yes}، لا ← ${s.no === "next" ? "التالية" : s.no === "end" ? "إنهاء" : s.no}`;
    case "exit": return "إنهاء المسار";
  }
}
