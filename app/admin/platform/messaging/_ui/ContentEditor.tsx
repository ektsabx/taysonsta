"use client";

import { useMemo, useState } from "react";
import { ActionForm, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { Tx, useT } from "@/components/bos/I18n";
import { EMAIL_CLASSES, VARIABLES } from "../../../../../Yolias/lib/messaging/catalog";
import { frame, sampleVars, templateErrors } from "../../../../../Yolias/lib/messaging/render";
import type { Rule } from "../../../../../Yolias/lib/messaging/rules";
import type { ActionState } from "@/lib/bos/action";
import { RulesField } from "./RulesEditor";

// Email content editor for templates and campaigns: subject, preview text,
// HTML body and optional text part, with a live preview of the full email
// (the same frame and variable filling the worker uses) and the variables
// that can be inserted. Problems are shown before saving.

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;
interface Content { id?: string; name: string; description: string | null; category: string; subject: string; preview_text: string | null; html: string; text_body: string | null }

export function ContentEditor({ action, value, siteUrl, readOnly, audience, submitLabel = "حفظ" }: {
  action: Action; value: Content; siteUrl: string; readOnly?: boolean; submitLabel?: string;
  /** Campaigns: the audience fields. */
  audience?: { segments: { value: string; label: string }[]; segmentId: string | null; rules: Rule[] };
}) {
  const t = useT();
  const [subject, setSubject] = useState(value.subject);
  const [preview, setPreview] = useState(value.preview_text ?? "");
  const [html, setHtml] = useState(value.html);
  const [text, setText] = useState(value.text_body ?? "");
  const [category, setCategory] = useState(value.category);
  const problems = useMemo(() => (html.trim() || subject.trim() ? templateErrors({ subject, html, preview_text: preview, text_body: text }) : []), [subject, html, preview, text]);
  const rendered = useMemo(() => frame({ subject, html, preview, text, siteUrl, vars: sampleVars(siteUrl), unsubscribeUrl: category === "transactional" ? null : `${siteUrl}/unsubscribe/sample` }), [subject, html, preview, text, siteUrl, category]);
  const insert = (name: string) => setHtml((h) => `${h}{{${name}}}`);

  return (
    <div className="msg-editor">
      <ActionForm action={action} successMessage="تم الحفظ">
        {value.id ? <input type="hidden" name="id" value={value.id} /> : null}
        <fieldset disabled={readOnly} className="msg-fieldset">
          <FormSection title="الرسالة">
            <TextField name="name" label="الاسم الداخلي" required defaultValue={value.name} maxLength={120} span={2} />
            <SelectField name="category" label="نوع الرسالة" value={category} onChange={(e) => setCategory(e.target.value)} options={EMAIL_CLASSES.map((c) => ({ value: c.value, label: c.label }))} span={2} />
            <TextAreaField name="description" label="الوصف" rows={2} defaultValue={value.description ?? ""} maxLength={500} />
            <TextField name="subject" label="عنوان الرسالة (Subject)" required value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} span="all" dir="auto" />
            <TextField name="preview_text" label="نص المعاينة (Preview text)" value={preview} onChange={(e) => setPreview(e.target.value)} maxLength={200} span="all" dir="auto" hint="يظهر بجانب العنوان في صندوق الوارد." />
            <TextAreaField name="html" label="المحتوى (HTML)" required rows={14} value={html} onChange={(e) => setHtml(e.target.value)} dir="ltr" hint="فقرات <p>، روابط <a href> بـ https أو بمتغير، صور <img> بروابط https. بدون سكربتات أو نماذج." />
            <div className="bos-field span-all">
              <label><Tx>المتغيرات</Tx></label>
              <div className="msg-vars">
                {VARIABLES.map((v) => <button key={v.name} type="button" className="admin-btn secondary small" onClick={() => insert(v.name)} title={t(v.label)} dir="ltr">{`{{${v.name}}}`}</button>)}
              </div>
              <span className="bos-hint"><Tx>تُملأ من بيانات كل مستخدم وقت الإرسال، ويتحقق النظام منها قبل الحفظ وقبل الإرسال.</Tx></span>
            </div>
            <TextAreaField name="text_body" label="النسخة النصية (اختياري)" rows={5} value={text} onChange={(e) => setText(e.target.value)} dir="auto" hint="فارغة: تُنشأ من المحتوى تلقائيًا." />
            {audience && (
              <>
                <SelectField name="segment_id" label="الشريحة" defaultValue={audience.segmentId ?? ""} placeholder="بدون شريحة" options={audience.segments} span={2} />
                <RulesField name="audience_rules" label="شروط إضافية للجمهور" defaultRules={audience.rules} count category={category} events={false} hint="الحملة تحتاج شريحة أو شرطًا واحدًا على الأقل. من ألغى الاشتراك من الرسائل لا يستلم." />
              </>
            )}
          </FormSection>
          {problems.length > 0 && (
            <ul className="msg-problems" role="alert">{problems.map((p) => <li key={p}><Tx>{p}</Tx></li>)}</ul>
          )}
          {!readOnly && <SubmitButton label={submitLabel} />}
        </fieldset>
      </ActionForm>
      <aside className="msg-preview" aria-label={t("معاينة")}>
        <div className="msg-preview-head">
          <strong dir="auto">{rendered.subject || t("(بدون عنوان)")}</strong>
          <span className="bos-faint" dir="auto">{preview}</span>
        </div>
        <iframe title={t("معاينة الرسالة")} sandbox="" srcDoc={rendered.html} />
        <span className="bos-hint"><Tx>معاينة ببيانات مثال. المتغيرات تُملأ من بيانات كل مستخدم عند الإرسال.</Tx></span>
      </aside>
    </div>
  );
}
