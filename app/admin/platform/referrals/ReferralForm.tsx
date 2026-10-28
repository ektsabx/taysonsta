"use client";

import { ActionForm, CheckboxField, FormSection, SubmitButton, TextField } from "@/components/bos/Form";
import { setReferralProgramAction } from "./actions";

export function ReferralForm({ value }: { value: { enabled: boolean; prospects: number; monthlyCap: number } }) {
  return (
    <ActionForm action={setReferralProgramAction} successMessage="تم الحفظ">
      <FormSection>
        <CheckboxField name="enabled" label="برنامج الدعوة مفعّل" defaultChecked={value.enabled} />
        <TextField name="prospects" label="عملاء محتملون لكل تسجيل" defaultValue={String(value.prospects)} dir="ltr" hint="تُضاف لرصيد صاحب الرابط ولا تنتهي صلاحيتها." />
        <TextField name="monthly_cap" label="الحد الشهري للمكافآت لكل مساحة" defaultValue={String(value.monthlyCap)} dir="ltr" hint="بعده يُسجَّل التسجيل بدون مكافأة." />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}
