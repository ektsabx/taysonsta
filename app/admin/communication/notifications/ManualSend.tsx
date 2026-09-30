"use client";

import { useState } from "react";
import { Tx, Opt } from "@/components/bos/I18n";
import { ModalButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { sendManualNotificationAction } from "./actions";

type O = { value: string; label: string };

// Manual notification (docs/bos/30 §9.4) to people / team / department /
// branch / role / everyone, in-app and optionally by email.
export function ManualSendButton({ options, allowAll }: { options: Record<"users" | "team" | "department" | "branch" | "role", O[]>; allowAll: boolean }) {
  const [kind, setKind] = useState<"users" | "team" | "department" | "branch" | "role" | "all">("users");
  const kinds = [
    { value: "users", label: "أشخاص محددون" },
    { value: "team", label: "فريق" },
    { value: "department", label: "قسم" },
    { value: "branch", label: "فرع" },
    { value: "role", label: "دور" },
    ...(allowAll ? [{ value: "all", label: "كل الموظفين" }] : []),
  ];
  return (
    <ModalButton label="إرسال إشعار" title="إرسال إشعار يدوي" className="admin-btn small">
      {(close) => (
        <ActionForm action={sendManualNotificationAction} onSuccess={close} successMessage="تم الإرسال">
          <div className="bos-form-grid">
            <div className="bos-field">
              <label><Tx>إلى</Tx></label>
              <select name="target_kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{kinds.map((k) => <Opt key={k.value} value={k.value}>{k.label}</Opt>)}</select>
            </div>
            {kind !== "all" ? (
              <div className="bos-field">
                <label><Tx>المستلمون</Tx></label>
                <select name="target_ids[]" multiple required style={{ minHeight: 110 }}>{options[kind].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              </div>
            ) : null}
            <SelectField name="priority" label="الأولوية" defaultValue="normal" options={[{ value: "low", label: "منخفضة" }, { value: "normal", label: "عادية" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }]} />
            <div className="bos-field">
              <label><Tx>القنوات</Tx></label>
              <label className="bos-check"><input type="checkbox" name="channels[]" value="in_app" defaultChecked /> <Tx>داخل النظام</Tx></label>
              <label className="bos-check"><input type="checkbox" name="channels[]" value="email" /> <Tx>البريد الإلكتروني</Tx></label>
            </div>
          </div>
          <TextField name="title" label="العنوان" required maxLength={200} />
          <TextAreaField name="body" label="النص" maxLength={4000} />
          <TextField name="link" label="رابط داخل النظام (اختياري)" dir="ltr" placeholder="/admin/knowledge/..." />
          <div className="bos-form-actions"><SubmitButton label="إرسال" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}
