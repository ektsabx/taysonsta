"use client";

import { Tx } from "@/components/bos/I18n";

import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { createAnnouncementAction, sendAnnouncementAction, setEmailEventAction, setFounderNoteAction } from "./actions";

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

/** Email + in-app switches of one event (saved on change). */
export function EmailEventForm({ kind, email, inApp, hasInApp }: { kind: string; email: boolean; inApp: boolean; hasInApp: boolean }) {
  return (
    <ActionForm action={setEmailEventAction} successMessage="تم الحفظ">
      <input type="hidden" name="kind" value={kind} />
      <span style={{ display: "inline-flex", gap: 14, alignItems: "center" }}>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="email" defaultChecked={email} onChange={(e) => e.currentTarget.form?.requestSubmit()} /><Tx>بريد</Tx></label>
        {hasInApp ? <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="in_app" defaultChecked={inApp} onChange={(e) => e.currentTarget.form?.requestSubmit()} /><Tx>داخل التطبيق</Tx></label> : <input type="hidden" name="in_app" value="on" />}
      </span>
    </ActionForm>
  );
}

/** The founder's note (D-273): written once here, sent by Yolias a day after each sign-up. */
export function FounderNoteForm({ value }: { value: { enabled: boolean; name: string; text_en: string; text_ar: string } }) {
  return (
    <ActionForm action={setFounderNoteAction} successMessage="تم الحفظ">
      <FormSection>
        <CheckboxField name="enabled" label="إرسال رسالة المؤسس" defaultChecked={value.enabled} hint="تصل مرة واحدة بعد يوم من التسجيل، لمن يترك «رسائل شخصية من مؤسسنا» مفعّلة." />
        <TextField name="name" label="اسم المؤسس" defaultValue={value.name} />
        <TextAreaField name="text_en" label="النص بالإنجليزية" rows={6} dir="ltr" defaultValue={value.text_en} hint="فقرات تفصلها سطر فارغ. بدون تحية في الأول (تُضاف تلقائيًا)." span={2} />
        <TextAreaField name="text_ar" label="النص بالعربية" rows={6} defaultValue={value.text_ar} span={2} />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}
