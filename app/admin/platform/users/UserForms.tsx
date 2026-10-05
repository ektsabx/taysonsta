"use client";

import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { useT } from "@/components/bos/I18n";
import { setSuspendedAction } from "./actions";

export function SuspendForm({ id, suspended }: { id: string; suspended: boolean }) {
  const t = useT();
  return (
    <ActionForm action={setSuspendedAction} successMessage={suspended ? "تمت استعادة الحساب" : "تم إيقاف الحساب"} guardUnsaved={false} className="">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="suspend" value={suspended ? "0" : "1"} />
      {!suspended && <input name="reason" placeholder={t("سبب الإيقاف")} aria-label={t("سبب الإيقاف")} required minLength={3} style={{ width: 140, marginInlineEnd: 6, padding: "4px 8px", border: "1px solid var(--bos-line, #ddd)", borderRadius: 6 }} />}
      <SubmitButton label={suspended ? "استعادة" : "إيقاف"} pendingLabel="..." className={`admin-btn small${suspended ? "" : " secondary"}`} />
    </ActionForm>
  );
}
