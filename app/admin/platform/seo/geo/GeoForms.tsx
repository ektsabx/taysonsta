"use client";

import { ActionForm, FormSection, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { addGeoPromptAction, startGeoRunAction } from "./actions";

export function AddPromptForm() {
  return (
    <ActionForm action={addGeoPromptAction} successMessage="تمت الإضافة">
      <FormSection>
        <TextField name="text" label="السؤال" required span={2} />
        <SelectField name="lang" label="اللغة" defaultValue="en" options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} />
        <TextField name="topic" label="الموضوع" dir="ltr" placeholder="meetings" />
      </FormSection>
      <SubmitButton label="إضافة" pendingLabel="جارٍ الإضافة..." />
    </ActionForm>
  );
}

export function RunNowForm() {
  return (
    <ActionForm action={startGeoRunAction} successMessage="بدأ القياس">
      <SubmitButton label="قياس الآن" pendingLabel="جارٍ البدء..." />
    </ActionForm>
  );
}
