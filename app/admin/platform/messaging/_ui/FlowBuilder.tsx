"use client";

import { useMemo, useState } from "react";
import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { Tx, useT } from "@/components/bos/I18n";
import { EMAIL_CLASSES, EVENTS, STEP_TYPES, selectableEvents } from "../../../../../Yolias/lib/messaging/catalog";
import type { Step } from "../../../../../Yolias/lib/messaging/flow";
import type { Rule } from "../../../../../Yolias/lib/messaging/rules";
import type { MsgFlowRow } from "../../../../../Yolias/types/database";
import { saveFlowAction } from "../actions";
import { RuleRows, RulesField } from "./RulesEditor";

// The automation / sequence builder (D-243): trigger, who may enter, the
// steps (email, in-app notice, wait, branch, end), when to stop, the goal,
// re-entry, sending hours and test mode. Saved as data; the Yolias worker
// runs it. Editing makes a new version: people already in it keep theirs.

type Opt = { value: string; label: string };
const groupLabel = { account: "الحساب", usage: "استخدام المنتج", billing: "الاشتراك والدفع" } as const;

function newStep(type: Step["type"], steps: Step[], templates: Opt[]): Step {
  let n = steps.length + 1;
  while (steps.some((s) => s.id === `s${n}`)) n++;
  const id = `s${n}`;
  switch (type) {
    case "email": return { id, type, template_id: templates[0]?.value ?? "" };
    case "notification": return { id, type, title: "", body: "", link: "" };
    case "wait": return { id, type, amount: 1, unit: "days" };
    case "branch": return { id, type, rules: [{ field: "has_plan", op: "is", value: false }], yes: "next", no: "end" };
    case "exit": return { id, type };
  }
}

export function FlowBuilder({ flow, templates, segments, canManage }: { flow: MsgFlowRow; templates: Opt[]; segments: Opt[]; canManage: boolean }) {
  const t = useT();
  const [steps, setSteps] = useState<Step[]>(Array.isArray(flow.steps) ? (flow.steps as unknown as Step[]) : []);
  const [testMode, setTestMode] = useState(flow.test_mode);
  const [reentry, setReentry] = useState(flow.reentry);
  const sendWindow = (flow.send_window ?? null) as { start: number; end: number } | null;
  const events = useMemo(() => (["account", "usage", "billing"] as const).map((g) => ({ g, list: selectableEvents.filter((e) => e.group === g) })), []);
  const set = (i: number, patch: Partial<Step>) => setSteps((all) => all.map((s, k) => (k === i ? ({ ...s, ...patch } as Step) : s)));
  const move = (i: number, d: -1 | 1) => setSteps((all) => {
    const j = i + d;
    if (j < 0 || j >= all.length) return all;
    const copy = [...all];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
  const targets = (i: number): Opt[] => [{ value: "next", label: "الخطوة التالية" }, { value: "end", label: "إنهاء المسار" }, ...steps.slice(i + 1).map((s, k) => ({ value: s.id, label: `${t("الخطوة")} ${i + 2 + k} (${s.id})` })).filter((o) => o.value !== "next" && o.value !== "end")];

  return (
    <ActionForm action={saveFlowAction} successMessage="تم الحفظ">
      <input type="hidden" name="id" value={flow.id} />
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <FormSection title="الأساسيات">
        <TextField name="name" label="الاسم" required defaultValue={flow.name} maxLength={120} span={2} />
        <SelectField name="category" label="نوع الرسائل" defaultValue={flow.category} options={EMAIL_CLASSES.map((c) => ({ value: c.value, label: c.label }))} span={2} />
        <TextAreaField name="description" label="الوصف" rows={2} defaultValue={flow.description ?? ""} maxLength={1000} />
      </FormSection>

      <FormSection title="متى يبدأ ومن يدخل">
        <div className="bos-field span-2">
          <label htmlFor="f-trigger_event"><Tx>حدث البداية (Trigger)</Tx><span className="req">*</span></label>
          <select id="f-trigger_event" name="trigger_event" defaultValue={flow.trigger_event} required>
            {events.map(({ g, list }) => (
              <optgroup key={g} label={t(groupLabel[g])}>
                {list.map((e) => <option key={e.id} value={e.id}>{t(e.label)}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="bos-hint"><Tx>الأحداث تأتي من سجل أحداث Yolias (الدفع والاشتراك والحساب والبحث) وليست من زيارة الصفحات فقط.</Tx></span>
        </div>
        <SelectField name="segment_id" label="الشريحة (اختياري)" defaultValue={flow.segment_id ?? ""} placeholder="بدون شريحة" options={segments} span={2} />
        <RulesField name="entry_rules" label="شروط الدخول" hint="تُفحص على بيانات المستخدم الحالية لحظة الحدث. يمكن استخدام بيانات الحدث نفسه (الحدث: الخطة، السبب…)." defaultRules={(flow.entry_rules ?? []) as Rule[]} count category={flow.category} />
        <SelectField name="reentry" label="إعادة الدخول" value={reentry} onChange={(e) => setReentry(e.target.value as typeof reentry)} options={[
          { value: "never", label: "مرة واحدة فقط لكل مستخدم" }, { value: "after_exit", label: "مرة أخرى بعد خروجه" }, { value: "always", label: "مع كل حدث (لا يتكرر لنفس الحدث)" },
        ]} span={2} />
        {reentry === "after_exit" && <TextField name="reentry_days" label="بعد كم يوم من الخروج" type="number" min={1} max={3650} defaultValue={flow.reentry_days ?? ""} hint="فارغ: فور خروجه." />}
      </FormSection>

      <FormSection title="الخطوات">
        <div className="bos-field span-all">
          <ol className="msg-steps">
            {steps.map((s, i) => (
              <li key={s.id} className={`msg-step msg-step-${s.type}`}>
                <div className="msg-step-head">
                  <strong>{i + 1}. {t(STEP_TYPES.find((x) => x.type === s.type)?.label ?? s.type)}</strong>
                  <span className="bos-faint" dir="ltr">{s.id}</span>
                  <span className="msg-step-tools">
                    <button type="button" className="admin-btn secondary small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("لأعلى")}>↑</button>
                    <button type="button" className="admin-btn secondary small" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={t("لأسفل")}>↓</button>
                    <button type="button" className="admin-btn danger small" onClick={() => setSteps(steps.filter((_, k) => k !== i))}><Tx>حذف</Tx></button>
                  </span>
                </div>
                {s.type === "email" && (
                  <select aria-label={t("القالب")} value={s.template_id} onChange={(e) => set(i, { template_id: e.target.value })}>
                    {!templates.some((x) => x.value === s.template_id) && <option value={s.template_id}>{t("قالب غير متاح")}</option>}
                    {templates.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {s.type === "notification" && (
                  <div className="msg-step-grid">
                    <input aria-label={t("عنوان الإشعار")} placeholder={t("عنوان الإشعار (يدعم المتغيرات)")} value={s.title} maxLength={200} onChange={(e) => set(i, { title: e.target.value })} dir="auto" />
                    <input aria-label={t("نص الإشعار")} placeholder={t("نص قصير (اختياري)")} value={s.body ?? ""} maxLength={500} onChange={(e) => set(i, { body: e.target.value })} dir="auto" />
                    <input aria-label={t("الرابط داخل Yolias")} placeholder="/checkout" value={s.link ?? ""} maxLength={300} onChange={(e) => set(i, { link: e.target.value })} dir="ltr" />
                  </div>
                )}
                {s.type === "wait" && (
                  <div className="msg-step-inline">
                    <input aria-label={t("المدة")} type="number" min={1} value={s.amount} onChange={(e) => set(i, { amount: Math.max(1, Math.round(Number(e.target.value))) })} />
                    <select aria-label={t("الوحدة")} value={s.unit} onChange={(e) => set(i, { unit: e.target.value as "minutes" | "hours" | "days" })}>
                      <option value="minutes">{t("دقيقة")}</option><option value="hours">{t("ساعة")}</option><option value="days">{t("يوم")}</option>
                    </select>
                  </div>
                )}
                {s.type === "branch" && (
                  <div className="msg-branch">
                    <RuleRows rules={s.rules} onChange={(rules) => set(i, { rules })} />
                    <div className="msg-step-inline">
                      <label><Tx>إذا تحققت</Tx> <select value={s.yes} onChange={(e) => set(i, { yes: e.target.value })}>{targets(i).map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}</select></label>
                      <label><Tx>إذا لم تتحقق</Tx> <select value={s.no} onChange={(e) => set(i, { no: e.target.value })}>{targets(i).map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}</select></label>
                    </div>
                  </div>
                )}
                {s.type === "exit" && <p className="bos-faint"><Tx>ينتهي المسار هنا لمن يصل إلى هذه الخطوة.</Tx></p>}
              </li>
            ))}
          </ol>
          <div className="msg-add-steps">
            {STEP_TYPES.map((x) => <button key={x.type} type="button" className="admin-btn secondary small" onClick={() => setSteps([...steps, newStep(x.type, steps, templates)])}>+ {t(x.label)}</button>)}
          </div>
          <span className="bos-hint"><Tx>قبل كل إرسال يعيد النظام فحص حالة المستخدم: الاشتراك، إلغاء الاشتراك من الرسائل، الحظر، وشروط الخروج.</Tx></span>
        </div>
      </FormSection>

      <FormSection title="متى يتوقف والهدف">
        <div className="bos-field span-all">
          <label><Tx>أحداث الخروج</Tx></label>
          <div className="msg-checks">
            {EVENTS.filter((e) => e.available !== false).map((e) => (
              <label key={e.id} className="bos-check"><input type="checkbox" name="exit_events" value={e.id} defaultChecked={flow.exit_events.includes(e.id)} /><Tx>{e.label}</Tx></label>
            ))}
          </div>
          <span className="bos-hint"><Tx>عند حدوث أي منها يخرج المستخدم فورًا وتُلغى رسائله التي لم تُرسل بعد.</Tx></span>
        </div>
        <RulesField name="exit_rules" label="شروط الخروج" hint="إذا تحققت كلها قبل أي خطوة، يخرج المستخدم." defaultRules={(flow.exit_rules ?? []) as Rule[]} />
        <SelectField name="goal_event" label="الهدف" defaultValue={flow.goal_event ?? ""} placeholder="بدون هدف" options={selectableEvents.map((e) => ({ value: e.id, label: e.label }))} span={2} />
        <CheckboxField name="exit_on_goal" label="الخروج عند تحقيق الهدف" defaultChecked={flow.exit_on_goal} />
      </FormSection>

      <FormSection title="التوقيت والاختبار">
        <TextField name="window_start" label="الإرسال من الساعة" type="number" min={0} max={23} defaultValue={sendWindow?.start ?? ""} hint="بتوقيت المستخدم. فارغ: أي وقت." />
        <TextField name="window_end" label="حتى الساعة" type="number" min={1} max={24} defaultValue={sendWindow?.end ?? ""} />
        <div className="bos-field">
          <label className="bos-check"><input type="checkbox" name="test_mode" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} /><Tx>وضع الاختبار</Tx></label>
          <span className="bos-hint"><Tx>في وضع الاختبار لا يدخل إلا عناوين الاختبار، ولا يستلم غيرها أي شيء.</Tx></span>
        </div>
        <TextField name="test_emails" label="عناوين الاختبار" defaultValue={flow.test_emails.join(", ")} dir="ltr" span={2} hint="مفصولة بفواصل. يجب أن تكون حسابات موجودة في Yolias لتجربة المسار." />
      </FormSection>
      {canManage ? <SubmitButton label="حفظ" /> : null}
    </ActionForm>
  );
}
