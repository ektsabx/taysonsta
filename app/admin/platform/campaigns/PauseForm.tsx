"use client";

import { ActionForm, SubmitButton, TextField } from "@/components/bos/Form";
import { pauseCampaignAction } from "./actions";

export function PauseForm({ id }: { id: string }) {
  return (
    <ActionForm action={pauseCampaignAction} successMessage="تم الإيقاف">
      <input type="hidden" name="id" value={id} />
      <div className="yd-inline-form">
        <TextField name="reason" label="سبب الإيقاف" required />
        <SubmitButton label="إيقاف" pendingLabel="جارٍ الإيقاف..." />
      </div>
    </ActionForm>
  );
}
