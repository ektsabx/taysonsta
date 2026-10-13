"use client";

import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { setSwitchAction } from "./actions";

export function SwitchForm({ k, on }: { k: string; on: boolean }) {
  return (
    <ActionForm action={setSwitchAction} successMessage={on ? "تم الإيقاف" : "تم التشغيل"} guardUnsaved={false} className="">
      <input type="hidden" name="key" value={k} />
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      <SubmitButton label={on ? "إيقاف" : "تشغيل"} pendingLabel="..." className={`admin-btn small${on ? " danger" : ""}`} />
    </ActionForm>
  );
}
