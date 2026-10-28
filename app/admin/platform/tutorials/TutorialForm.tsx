"use client";

import { ActionForm, CheckboxField, FormSection, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { saveTutorialAction } from "./actions";

type Value = { id: string; title: { ar: string; en: string }; description: { ar: string; en: string }; url: string; published: boolean } | null;

export function TutorialForm({ value }: { value: Value }) {
  return (
    <ActionForm action={saveTutorialAction} successMessage="تم الحفظ">
      {value && <input type="hidden" name="id" value={value.id} />}
      <FormSection>
        <TextField name="url" label="رابط الفيديو" defaultValue={value?.url ?? ""} dir="ltr" placeholder="https://www.youtube.com/watch?v=…" span={2} hint="YouTube أو Vimeo أو Loom، أو رابط مباشر لملف ‎.mp4 / .webm (https)." />
        <TextField name="title_ar" label="العنوان بالعربية" defaultValue={value?.title.ar ?? ""} maxLength={200} />
        <TextField name="title_en" label="العنوان بالإنجليزية" defaultValue={value?.title.en ?? ""} maxLength={200} dir="ltr" />
        <TextAreaField name="desc_ar" label="وصف قصير بالعربية (اختياري)" defaultValue={value?.description.ar ?? ""} maxLength={600} rows={2} />
        <TextAreaField name="desc_en" label="وصف قصير بالإنجليزية (اختياري)" defaultValue={value?.description.en ?? ""} maxLength={600} rows={2} />
        <CheckboxField name="published" label="منشور في صفحة شرح المنصة" defaultChecked={value?.published ?? true} />
      </FormSection>
      <SubmitButton label={value ? "حفظ التعديل" : "إضافة الفيديو"} />
    </ActionForm>
  );
}
