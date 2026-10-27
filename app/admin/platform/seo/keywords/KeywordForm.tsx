"use client";

import { ActionForm, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { deleteKeywordAction, saveKeywordAction } from "../actions";

export interface KeywordValues {
  id: string | null; keyword: string; locale: string; intent: string; cluster: string; pageType: string; priority: string; stage: string; targetPath: string;
  volume: string; volumeSource: string; difficulty: string; difficultySource: string; notes: string; related: string;
}

export const intentLabel: Record<string, string> = { informational: "معلوماتية", commercial: "تجارية", comparison: "مقارنة", transactional: "شرائية", navigational: "تنقّل (اسم منتج)" };
export const stageLabel: Record<string, string> = { idea: "فكرة", researching: "قيد البحث", planned: "مخطط لها", writing: "قيد الكتابة", review: "قيد المراجعة", published: "منشورة", monitoring: "متابعة", dropped: "مستبعدة" };
export const pageTypeLabel: Record<string, string> = { compare: "مقارنة", alternatives: "بدائل", solution: "حل لجمهور", template: "قالب", use_case: "حالة استخدام", blog: "مقال", help: "مساعدة", core: "صفحة أساسية" };
const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

// A keyword and what we plan to do with it (D-257). Volume and difficulty
// need their source: a tool's name, or manual_estimate for a person's guess.
export function KeywordForm({ v }: { v: KeywordValues }) {
  return (
    <>
      <ActionForm action={saveKeywordAction} successMessage="تم الحفظ" resetOnSuccess={!v.id}>
        {v.id && <input type="hidden" name="id" value={v.id} />}
        <FormSection>
          <TextField name="keyword" label="الكلمة" dir="auto" required defaultValue={v.keyword} />
          <SelectField name="locale" label="اللغة" defaultValue={v.locale} options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} />
          <SelectField name="intent" label="نية البحث" defaultValue={v.intent} options={opts(intentLabel)} />
          <TextField name="cluster" label="المجموعة" dir="auto" defaultValue={v.cluster} hint="مثل: apollo، agencies، templates-market" />
          <SelectField name="page_type" label="نوع الصفحة المناسبة" defaultValue={v.pageType} options={[{ value: "", label: "—" }, ...opts(pageTypeLabel)]} />
          <SelectField name="priority" label="الأولوية" defaultValue={v.priority} options={[{ value: "1", label: "عالية" }, { value: "2", label: "متوسطة" }, { value: "3", label: "منخفضة" }]} />
          <SelectField name="stage" label="المرحلة" defaultValue={v.stage} options={opts(stageLabel)} />
          <TextField name="target_path" label="الصفحة المرتبطة" dir="ltr" defaultValue={v.targetPath} placeholder="/compare/apollo" />
          <TextField name="volume" label="حجم البحث الشهري" type="number" defaultValue={v.volume} hint="فارغ = غير معروف" />
          <TextField name="volume_source" label="مصدر الحجم" dir="ltr" defaultValue={v.volumeSource} placeholder="manual_estimate" />
          <TextField name="difficulty" label="صعوبة المنافسة (0 - 100)" type="number" defaultValue={v.difficulty} />
          <TextField name="difficulty_source" label="مصدر الصعوبة" dir="ltr" defaultValue={v.difficultySource} />
          <TextField name="related" label="كلمات مرتبطة" dir="auto" defaultValue={v.related} hint="مفصولة بفواصل" span={2} />
          <TextAreaField name="notes" label="ملاحظات البحث" dir="auto" rows={3} defaultValue={v.notes} span={2} />
        </FormSection>
        <SubmitButton label={v.id ? "حفظ" : "إضافة الكلمة"} />
      </ActionForm>
      {v.id && (
        <ActionForm action={deleteKeywordAction} successMessage="حُذفت">
          <input type="hidden" name="id" value={v.id} />
          <SubmitButton label="حذف الكلمة" className="admin-btn secondary" />
        </ActionForm>
      )}
    </>
  );
}
