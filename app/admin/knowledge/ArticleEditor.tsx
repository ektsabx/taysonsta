"use client";

import { Tx } from "@/components/bos/I18n";

import { useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { renderMarkdown } from "@/lib/bos/markdown";

type Opt = { value: string; label: string };

export interface ArticleValues {
  kind?: string;
  title?: string;
  slug?: string;
  content?: string;
  category_id?: string | null;
  tags?: string[];
  owner_id?: string | null;
  allowed_role_ids?: string[] | null;
  playbook_section?: string | null;
  required_documents?: string | null;
  status?: string;
  language?: string;
  audience?: string;
  ai_allowed?: boolean;
}

const kinds: Opt[] = [
  { value: "article", label: "مقال" },
  { value: "sop", label: "إجراء تشغيل (SOP)" },
  { value: "playbook", label: "دليل مبيعات" },
  { value: "documentation", label: "توثيق" },
  { value: "policy", label: "سياسة" },
  { value: "onboarding_guide", label: "دليل تهيئة" },
];

export function ArticleEditor({ action, initial = {}, categories, roles, staff, sections, canPublish }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; initial?: ArticleValues; categories: Opt[]; roles: Opt[]; staff: Opt[]; sections: Opt[]; canPublish: boolean }) {
  const [kind, setKind] = useState(initial.kind ?? "article");
  const [content, setContent] = useState(initial.content ?? "");
  const [preview, setPreview] = useState(false);
  return (
    <ActionForm action={action}>
      <FormSection>
        <div className="bos-form-grid">
          <TextField name="title" label="العنوان" required defaultValue={initial.title ?? ""} span={2} />
          <SelectField name="kind" label="النوع" options={kinds} value={kind} onChange={(e) => setKind(e.target.value)} />
          <SelectField name="category_id" label="التصنيف" required placeholder="اختر..." options={categories} defaultValue={initial.category_id ?? ""} />
          {kind === "playbook" ? <SelectField name="playbook_section" label="قسم الدليل" required placeholder="اختر..." options={sections} defaultValue={initial.playbook_section ?? ""} /> : <input type="hidden" name="playbook_section" value="" />}
          <TextField name="tags" label="الوسوم (مفصولة بفواصل)" defaultValue={(initial.tags ?? []).join(", ")} />
          <TextField name="slug" label="الرابط المختصر" dir="ltr" defaultValue={initial.slug ?? ""} hint="يُولّد تلقائياً من العنوان إن تُرك فارغاً" />
          <SelectField name="owner_id" label="المالك" placeholder="—" options={staff} defaultValue={initial.owner_id ?? ""} />
          <SelectField name="status" label="الحالة" options={canPublish ? [{ value: "draft", label: "مسودة" }, { value: "published", label: "منشور" }] : [{ value: "draft", label: "مسودة (النشر يتطلب صلاحية الإدارة)" }]} defaultValue={canPublish ? initial.status ?? "draft" : "draft"} />
        </div>
      </FormSection>
      <FormSection title="المحتوى (Markdown)">
        <div className="bos-row" style={{ gap: 6, marginBottom: 6 }}>
          <button type="button" className={`admin-btn small ${preview ? "ghost" : "secondary"}`} onClick={() => setPreview(false)}><Tx>تحرير</Tx></button>
          <button type="button" className={`admin-btn small ${preview ? "secondary" : "ghost"}`} onClick={() => setPreview(true)}><Tx>معاينة</Tx></button>
          <span className="bos-faint" style={{ fontSize: 12 }}>{Math.round(content.length / 1024)}KB / 200KB</span>
        </div>
        <textarea name="content" value={content} onChange={(e) => setContent(e.target.value)} rows={18} maxLength={200000} style={{ width: "100%", display: preview ? "none" : "block", fontFamily: "ui-monospace, monospace", direction: "auto" as never }} aria-label="المحتوى" />
        {preview ? <div className="bos-prose bos-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} /> : null}
      </FormSection>
      {kind === "sop" ? (
        <FormSection title="المستندات المطلوبة">
          <TextAreaField name="required_documents" label="المستندات المطلوبة" rows={3} defaultValue={initial.required_documents ?? ""} />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الخطوات وقائمة التحقق تُدار من صفحة الإجراء بعد الحفظ.</Tx></p>
        </FormSection>
      ) : null}
      <FormSection title="الصلاحيات">
        <div className="bos-row" style={{ gap: 10, flexWrap: "wrap" }}>
          {roles.map((r) => (
            <label key={r.value} className="bos-check">
              <input type="checkbox" name="allowed_role_ids[]" value={r.value} defaultChecked={initial.allowed_role_ids?.includes(r.value)} />
              <Tx>{r.label}</Tx>
            </label>
          ))}
        </div>
        <p className="bos-faint" style={{ fontSize: 12 }}><Tx>بدون اختيار = متاح لكل الموظفين. عند التقييد يُخفى المقال من القوائم والبحث والرابط المباشر لغير المصرح لهم.</Tx></p>
      </FormSection>
      <FormSection title="المساعد الذكي والجمهور">
        <div className="bos-form-grid">
          <SelectField name="language" label="لغة المقال" options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} defaultValue={initial.language ?? "ar"} />
          <SelectField name="audience" label="الجمهور" options={[{ value: "internal", label: "داخلي (الموظفون فقط)" }, { value: "public", label: "عام (يمكن مشاركته مع العملاء)" }]} defaultValue={initial.audience ?? "internal"} />
          <CheckboxField name="ai_allowed" label="متاح لوكلاء الذكاء الاصطناعي" defaultChecked={initial.ai_allowed ?? false} hint="يستخدمه وكيل الدعم الذكي في الرد على العملاء. يجب أن يكون المقال منشوراً وعاماً." />
        </div>
      </FormSection>
      <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
    </ActionForm>
  );
}
