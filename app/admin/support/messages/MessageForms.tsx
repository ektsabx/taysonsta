"use client";

import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { useT } from "@/components/bos/I18n";
import { setNotifyAction, setStatusAction } from "./actions";

const labels: Record<string, string> = { new: "جديدة", in_progress: "قيد المعالجة", resolved: "تم الحل" };

export function StatusForm({ id, status }: { id: string; status: string }) {
  const t = useT();
  return (
    <ActionForm action={setStatusAction} successMessage="تم تحديث الحالة" guardUnsaved={false} className="support-msg-status">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} aria-label={t("الحالة")} className="llm-input">
        {Object.entries(labels).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
      </select>
      <SubmitButton label="حفظ" pendingLabel="..." className="admin-btn small" />
    </ActionForm>
  );
}

export function NotifyForm({ email }: { email: string }) {
  const t = useT();
  return (
    <ActionForm action={setNotifyAction} successMessage="تم الحفظ" guardUnsaved={false} className="support-msg-notify">
      <label htmlFor="notify-email">{t("أرسل بريدًا لكل رسالة جديدة إلى")}</label>
      <input id="notify-email" name="email" type="email" dir="ltr" defaultValue={email} placeholder="support@yolias.com" className="llm-input" />
      <SubmitButton label="حفظ" pendingLabel="..." className="admin-btn small" />
    </ActionForm>
  );
}
