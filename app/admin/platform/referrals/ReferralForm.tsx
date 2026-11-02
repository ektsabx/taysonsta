"use client";

import { ActionForm, CheckboxField, FormSection, SubmitButton, TextField } from "@/components/bos/Form";
import { decideReferralAction, setReferralProgramAction } from "./actions";

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

/** Approve or reject one referral held for review (D-273). */
export function ReviewForm({ id }: { id: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <ActionForm action={decideReferralAction} successMessage="تمت الموافقة ومُنحت المكافأة">
        <input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="approve" />
        <SubmitButton label="موافقة" pendingLabel="..." className="admin-btn small" />
      </ActionForm>
      <ActionForm action={decideReferralAction} successMessage="تم الرفض">
        <input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="reject" />
        <SubmitButton label="رفض" pendingLabel="..." className="admin-btn small secondary" />
      </ActionForm>
    </span>
  );
}
