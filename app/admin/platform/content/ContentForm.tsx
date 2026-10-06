"use client";

import { ActionForm, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { docGroups, helpCollections, type ContentKind } from "@/lib/yolias/content";
import { deleteContentAction, saveContentAction } from "./actions";

export interface ContentFormValues {
  id: string | null;
  kind: ContentKind;
  slug: string;
  status: string;
  sort: number;
  collection: string;
  group: string;
  date: string;
  categoryEn: string;
  categoryAr: string;
  en: { title: string; summary: string; body: string };
  ar: { title: string; summary: string; body: string };
}

const statusOptions = [
  { value: "draft", label: "مسودة (لا تظهر)" },
  { value: "published", label: "منشورة" },
  { value: "hidden", label: "مخفية من الموقع" },
];

// Editor for one website page: both languages side by side. Body in simple
// Markdown: "## " heading, "### " sub-heading, "- " list, "1. " numbered,
// "> " note, "| a | b |" table, **bold**, [label](/link).
export function ContentForm({ v }: { v: ContentFormValues }) {
  return (
    <>
      <ActionForm action={saveContentAction} successMessage="تم الحفظ">
        {v.id && <input type="hidden" name="id" value={v.id} />}
        <input type="hidden" name="kind" value={v.kind} />
        <FormSection title="الصفحة">
          <TextField name="slug" label="الرابط" dir="ltr" required defaultValue={v.slug} readOnly={v.kind === "legal" && Boolean(v.id)} hint={`/${v.kind === "help" ? "help-center" : v.kind}/…`} />
          <SelectField name="status" label="الحالة" defaultValue={v.status} options={statusOptions} />
          <TextField name="sort" label="الترتيب" type="number" step={1} defaultValue={String(v.sort)} />
          {v.kind === "help" && <SelectField name="collection" label="القسم" defaultValue={v.collection} options={helpCollections.map((c) => ({ value: c.id, label: c.label }))} />}
          {v.kind === "docs" && <SelectField name="group" label="المجموعة" defaultValue={v.group} options={docGroups.map((g) => ({ value: g.id, label: g.label }))} />}
          {v.kind === "blog" && (
            <>
              <TextField name="date" label="التاريخ" type="date" required defaultValue={v.date} />
              <TextField name="category_en" label="التصنيف (EN)" dir="ltr" required defaultValue={v.categoryEn} />
              <TextField name="category_ar" label="التصنيف (AR)" required defaultValue={v.categoryAr} />
            </>
          )}
        </FormSection>
        <div className="content-langs">
          <FormSection title="English">
            <TextField name="title_en" label="العنوان" dir="ltr" required defaultValue={v.en.title} span={2} />
            <TextAreaField name="summary_en" label="الملخص" dir="ltr" rows={2} defaultValue={v.en.summary} span={2} />
            <TextAreaField name="body_en" label="المحتوى (Markdown)" dir="ltr" rows={22} required defaultValue={v.en.body} span={2} />
          </FormSection>
          <FormSection title="العربية">
            <TextField name="title_ar" label="العنوان" dir="rtl" required defaultValue={v.ar.title} span={2} />
            <TextAreaField name="summary_ar" label="الملخص" dir="rtl" rows={2} defaultValue={v.ar.summary} span={2} />
            <TextAreaField name="body_ar" label="المحتوى (Markdown)" dir="rtl" rows={22} required defaultValue={v.ar.body} span={2} />
          </FormSection>
        </div>
        <p className="bos-faint" style={{ fontSize: 12 }}>## عنوان · ### عنوان فرعي · - قائمة · 1. قائمة مرقّمة · &gt; ملاحظة · | جدول | · **عريض** · [نص](/رابط)</p>
        <SubmitButton />
      </ActionForm>
      {v.id && v.kind !== "legal" && (
        <ActionForm action={deleteContentAction} successMessage="تم الحذف">
          <input type="hidden" name="id" value={v.id} />
          <input type="hidden" name="kind" value={v.kind} />
          <SubmitButton label="حذف الصفحة" className="admin-btn secondary" />
        </ActionForm>
      )}
    </>
  );
}
