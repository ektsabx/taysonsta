"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { useT } from "@/components/bos/I18n";
import { setOnboardingStepsAction } from "./actions";

// Onboarding pages editor (owner, 2026-11-03, D-276): order, on/off, each
// page's title and description in Arabic and English, and new pages with
// their own questions (short text, long text, one choice, several choices).
// The company page is always first and on: Yolias works from it.
type L = { ar: string; en: string };
type Field = { key: string; label: L; type: "text" | "textarea" | "select" | "multi"; required: boolean; options: L[] };
type Step = { id: string; kind: "company" | "source" | "custom"; enabled: boolean; title: L; lead: L; fields: Field[] };

const KIND_LABEL: Record<Step["kind"], string> = { company: "الشركة والموقع", source: "كيف عرفت عنا؟", custom: "صفحة جديدة" };
const TYPE_LABEL: Record<Field["type"], string> = { text: "نص قصير", textarea: "نص طويل", select: "اختيار واحد", multi: "عدة اختيارات" };
const slug = (prefix: string, taken: string[]) => { let i = 1; while (taken.includes(`${prefix}${i}`)) i++; return `${prefix}${i}`; };

export function StepsEditor({ initial }: { initial: Step[] }) {
  const t = useT();
  const [steps, setSteps] = useState<Step[]>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const update = (id: string, patch: Partial<Step>) => setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => setSteps((all) => {
    const j = i + d;
    if (j < 1 || j >= all.length || i < 1) return all;
    const next = [...all]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const add = () => {
    const id = slug("step", steps.map((s) => s.id));
    setSteps((all) => [...all, { id, kind: "custom", enabled: true, title: { ar: "", en: "" }, lead: { ar: "", en: "" }, fields: [{ key: "q1", label: { ar: "", en: "" }, type: "text", required: false, options: [] }] }]);
    setOpen(id);
  };
  const setField = (s: Step, k: number, patch: Partial<Field>) => update(s.id, { fields: s.fields.map((f, i) => (i === k ? { ...f, ...patch } : f)) });
  const bi = (value: L, on: (v: L) => void, label: string, long = false) => (
    <div className="yd-bi">
      <span className="yd-bi-label">{t(label)}</span>
      {(["ar", "en"] as const).map((lang) => long
        ? <textarea key={lang} dir={lang === "ar" ? "rtl" : "ltr"} rows={2} maxLength={400} placeholder={lang === "ar" ? "العربية" : "English"} value={value[lang]} onChange={(e) => on({ ...value, [lang]: e.target.value })} />
        : <input key={lang} dir={lang === "ar" ? "rtl" : "ltr"} maxLength={160} placeholder={lang === "ar" ? "العربية" : "English"} value={value[lang]} onChange={(e) => on({ ...value, [lang]: e.target.value })} />)}
    </div>
  );

  return (
    <ActionForm action={setOnboardingStepsAction} successMessage="تم الحفظ" className="yd-steps">
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <ol className="yd-step-list">
        {steps.map((s, i) => (
          <li key={s.id} className={`yd-step${s.enabled ? "" : " off"}`}>
            <div className="yd-step-row">
              <span className="yd-step-n" dir="ltr">{i + 1}</span>
              <button type="button" className="yd-step-name" onClick={() => setOpen(open === s.id ? null : s.id)}>
                <strong>{(s.title.ar || s.title.en) || t(KIND_LABEL[s.kind])}</strong>
                <small>{t(KIND_LABEL[s.kind])}{s.kind === "custom" ? ` · ${s.fields.length}` : ""}</small>
              </button>
              <div className="yd-step-tools">
                <button type="button" className="yd-btn ghost" aria-label={t("أعلى")} disabled={i <= 1} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="yd-btn ghost" aria-label={t("أسفل")} disabled={i === 0 || i === steps.length - 1} onClick={() => move(i, 1)}>↓</button>
                {s.kind !== "company" && <label className="yd-switch"><input type="checkbox" checked={s.enabled} onChange={(e) => update(s.id, { enabled: e.target.checked })} />{t("تشغيل")}</label>}
                {s.kind === "custom" && <button type="button" className="yd-btn ghost danger" onClick={() => { if (confirm(t("حذف هذه الصفحة؟"))) setSteps((all) => all.filter((x) => x.id !== s.id)); }}>{t("حذف")}</button>}
              </div>
            </div>
            {open === s.id && (
              <div className="yd-step-body">
                {bi(s.title, (v) => update(s.id, { title: v }), "العنوان")}
                {bi(s.lead, (v) => update(s.id, { lead: v }), "الوصف", true)}
                {s.kind === "custom" && (
                  <div className="yd-questions">
                    {s.fields.map((f, k) => (
                      <div key={f.key} className="yd-question">
                        {bi(f.label, (v) => setField(s, k, { label: v }), "السؤال")}
                        <div className="yd-question-row">
                          <select value={f.type} onChange={(e) => setField(s, k, { type: e.target.value as Field["type"], options: e.target.value === "select" || e.target.value === "multi" ? (f.options.length ? f.options : [{ ar: "", en: "" }, { ar: "", en: "" }]) : [] })}>
                            {(Object.keys(TYPE_LABEL) as Field["type"][]).map((ty) => <option key={ty} value={ty}>{t(TYPE_LABEL[ty])}</option>)}
                          </select>
                          <label className="yd-switch"><input type="checkbox" checked={f.required} onChange={(e) => setField(s, k, { required: e.target.checked })} />{t("إجباري")}</label>
                          {s.fields.length > 1 && <button type="button" className="yd-btn ghost danger" onClick={() => update(s.id, { fields: s.fields.filter((_, x) => x !== k) })}>{t("حذف السؤال")}</button>}
                        </div>
                        {(f.type === "select" || f.type === "multi") && (
                          <div className="yd-options">
                            {f.options.map((o, oi) => (
                              <div key={oi} className="yd-option">
                                {bi(o, (v) => setField(s, k, { options: f.options.map((x, xi) => (xi === oi ? v : x)) }), `${t("خيار")} ${oi + 1}`)}
                                {f.options.length > 2 && <button type="button" className="yd-btn ghost" aria-label={t("حذف")} onClick={() => setField(s, k, { options: f.options.filter((_, xi) => xi !== oi) })}>×</button>}
                              </div>
                            ))}
                            {f.options.length < 30 && <button type="button" className="yd-btn" onClick={() => setField(s, k, { options: [...f.options, { ar: "", en: "" }] })}>{t("إضافة خيار")}</button>}
                          </div>
                        )}
                      </div>
                    ))}
                    {s.fields.length < 12 && <button type="button" className="yd-btn" onClick={() => update(s.id, { fields: [...s.fields, { key: slug("q", s.fields.map((f) => f.key)), label: { ar: "", en: "" }, type: "text", required: false, options: [] }] })}>{t("إضافة سؤال")}</button>}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="yd-steps-foot">
        <button type="button" className="yd-btn" onClick={add}>{t("إضافة صفحة")}</button>
        <SubmitButton label="حفظ" className="yd-btn primary" />
      </div>
    </ActionForm>
  );
}
