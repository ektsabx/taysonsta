"use client";

import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { setReviewPopupAction } from "./actions";

export function ReviewForm({ value }: { value: { enabled: boolean; url: string; trigger: string } }) {
  return (
    <ActionForm action={setReviewPopupAction} successMessage="تم الحفظ">
      <FormSection>
        <CheckboxField name="enabled" label="تشغيل" defaultChecked={value.enabled} />
        <SelectField name="trigger" label="يظهر بعد" defaultValue={value.trigger} options={[{ value: "first_meeting", label: "أول اجتماع محجوز" }, { value: "first_positive_reply", label: "أول رد إيجابي" }, { value: "first_campaign", label: "إطلاق أول حملة" }]} />
        <TextField name="url" label="رابط التقييم" defaultValue={value.url} dir="ltr" span={2} />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}
