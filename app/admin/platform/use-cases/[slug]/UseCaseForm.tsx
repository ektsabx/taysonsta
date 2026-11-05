"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { Tx } from "@/components/bos/I18n";
import { saveUseCaseAction } from "../actions";

type Step = { title: string; where: string; body: string[]; result: string; shot: string };
type Text = { name: string; title: string; lead: string; seoTitle: string; seoDescription: string; used: { name: string; role: string }[]; problem: string[]; how: string[]; steps: Step[]; act: string[] };
type Doc = { en: Text; ar: Text };
const blank = (): Text => ({ name: "", title: "", lead: "", seoTitle: "", seoDescription: "", used: [], problem: [], how: [], steps: [{ title: "", where: "", body: [""], result: "", shot: "builder" }], act: [] });
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

// Every field of a use case, in both languages. One line = one item.
export function UseCaseForm({ slug, status, doc, meta, shots }: { slug: string; status: string; doc: Doc | null; meta: Record<string, unknown>; shots: string[] }) {
  const [d, setD] = useState<Doc>(doc ?? { en: blank(), ar: blank() });
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [m, setM] = useState({ template: String(meta.template ?? ""), related: ((meta.related as string[]) ?? []).join(", "), category: String(meta.category ?? "find") });
  const x = d[lang];
  const set = (p: Partial<Text>) => setD({ ...d, [lang]: { ...x, ...p } });
  const step = (i: number, p: Partial<Step>) => set({ steps: x.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const text = (label: string, k: "name" | "title" | "lead" | "seoTitle" | "seoDescription") => <div className="bos-field"><label><Tx>{label}</Tx></label><input dir="auto" value={x[k]} onChange={(e) => set({ [k]: e.target.value })} /></div>;
  const list = (label: string, k: "problem" | "how" | "act") => <div className="bos-field"><label><Tx>{label}</Tx></label><textarea dir="auto" rows={4} value={x[k].join("\n")} onChange={(e) => set({ [k]: e.target.value.split("\n") })} /></div>;
  const clean = (t: Text): Text => ({ ...t, problem: t.problem.filter(Boolean), how: t.how.filter(Boolean), act: t.act.filter(Boolean), steps: t.steps.map((s) => ({ ...s, body: s.body.filter(Boolean) })) });
  return (
    <ActionForm action={saveUseCaseAction} successMessage="تم الحفظ" guardUnsaved={false} className="bos-form">
      <input type="hidden" name="doc" value={JSON.stringify({ en: clean(d.en), ar: clean(d.ar) })} />
      <input type="hidden" name="meta" value={JSON.stringify({ ...meta, category: m.category, template: m.template || null, related: lines(m.related.replace(/,/g, "\n")) })} />
      <div className="bos-field"><label><Tx>الرابط</Tx></label><input name="slug" defaultValue={slug} readOnly={Boolean(slug)} dir="ltr" placeholder="find-new-clients" /></div>
      <div className="bos-field"><label><Tx>الحالة</Tx></label><select name="status" defaultValue={status}><option value="published">منشور</option><option value="draft">مسودة</option></select></div>
      <div className="bos-field"><label><Tx>رابط القالب (اختياري)</Tx></label><input dir="ltr" value={m.template} onChange={(e) => setM({ ...m, template: e.target.value })} placeholder="/templates/companies-by-industry" /></div>
      <div className="bos-field"><label><Tx>حالات ذات صلة (روابط مفصولة بفاصلة)</Tx></label><input dir="ltr" value={m.related} onChange={(e) => setM({ ...m, related: e.target.value })} /></div>
      <div className="bos-field"><label><Tx>اللغة</Tx></label><select value={lang} onChange={(e) => setLang(e.target.value as "ar" | "en")}><option value="ar">العربية</option><option value="en">English</option></select></div>
      {text("الاسم", "name")}{text("العنوان", "title")}{text("الوصف", "lead")}{text("عنوان SEO", "seoTitle")}{text("وصف SEO", "seoDescription")}
      {list("قبل أن نبدأ (كل سطر فقرة)", "problem")}{list("كيف يعمل (كل سطر نقطة)", "how")}
      <div className="bos-field"><label><Tx>ما استخدمناه (كل سطر: الاسم | الدور)</Tx></label><textarea dir="auto" rows={5} value={x.used.map((u) => `${u.name} | ${u.role}`).join("\n")} onChange={(e) => set({ used: e.target.value.split("\n").map((l) => { const [name, ...r] = l.split("|"); return { name: name.trim(), role: r.join("|").trim() }; }) })} /></div>
      {x.steps.map((s, i) => (
        <fieldset key={i} className="bos-field">
          <legend><Tx>الخطوة</Tx> {i + 1}</legend>
          <input dir="auto" placeholder="العنوان" value={s.title} onChange={(e) => step(i, { title: e.target.value })} />
          <input dir="auto" placeholder="المكان" value={s.where} onChange={(e) => step(i, { where: e.target.value })} />
          <textarea dir="auto" rows={3} placeholder="الشرح (كل سطر فقرة)" value={s.body.join("\n")} onChange={(e) => step(i, { body: e.target.value.split("\n") })} />
          <input dir="auto" placeholder="ما يجب أن يراه" value={s.result} onChange={(e) => step(i, { result: e.target.value })} />
          <select value={s.shot} onChange={(e) => step(i, { shot: e.target.value })}>{shots.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <button type="button" className="admin-btn small" onClick={() => set({ steps: x.steps.filter((_, j) => j !== i) })}><Tx>حذف الخطوة</Tx></button>
        </fieldset>
      ))}
      <button type="button" className="admin-btn small" onClick={() => set({ steps: [...x.steps, { title: "", where: "", body: [""], result: "", shot: "builder" }] })}><Tx>إضافة خطوة</Tx></button>
      {list("ماذا تفعل بالنتائج (كل سطر نقطة)", "act")}
      <SubmitButton label="حفظ" pendingLabel="..." className="admin-btn small app-save" />
    </ActionForm>
  );
}
