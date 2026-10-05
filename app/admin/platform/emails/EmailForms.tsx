"use client";

import { ActionForm, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { createAnnouncementAction, sendAnnouncementAction } from "./actions";

const types = [
  { value: "new_feature", label: "ميزة جديدة (Introducing …)" },
  { value: "feature_available", label: "ميزة متاحة الآن" },
  { value: "feature_updated", label: "تحديث ميزة" },
  { value: "important_changes", label: "تغييرات مهمة" },
  { value: "plan_changes", label: "تغييرات على الخطط" },
  { value: "pricing_change", label: "أسعار جديدة قادمة" },
  { value: "service_update", label: "تحديث الخدمة" },
];

export function AnnouncementForm() {
  return (
    <ActionForm action={createAnnouncementAction} successMessage="تم حفظ المسودة" resetOnSuccess guardUnsaved={false}>
      <FormSection>
        <SelectField name="type" label="النوع" required options={types} />
        <SelectField name="audience" label="المستلمون" required options={[
          { value: "opted_in", label: "من فعّل «تحديثات المنتج»" },
          { value: "all", label: "كل المستخدمين (تغييرات مهمة/خطط/أسعار/خدمة فقط)" },
        ]} />
        <TextField name="title_en" label="العنوان (English)" required span={2} dir="ltr" />
        <TextField name="title_ar" label="العنوان (العربية)" required span={2} dir="rtl" />
        <TextAreaField name="body_en" label="النص (English)" required dir="ltr" rows={5} hint="سطر فارغ = فقرة جديدة." />
        <TextAreaField name="body_ar" label="النص (العربية)" required dir="rtl" rows={5} />
        <TextField name="cta_label_en" label="نص الزر (English)" dir="ltr" />
        <TextField name="cta_label_ar" label="نص الزر (العربية)" dir="rtl" />
        <TextField name="cta_url" label="رابط الزر (https)" span={2} dir="ltr" placeholder="https://" />
      </FormSection>
      <SubmitButton label="حفظ كمسودة" />
    </ActionForm>
  );
}

export function SendAnnouncementButton({ id }: { id: string }) {
  return (
    <ActionForm action={sendAnnouncementAction} successMessage="تمت جدولة الإرسال" guardUnsaved={false} className="">
      <input type="hidden" name="id" value={id} />
      <SubmitButton label="إرسال" pendingLabel="..." className="admin-btn small" />
    </ActionForm>
  );
}
