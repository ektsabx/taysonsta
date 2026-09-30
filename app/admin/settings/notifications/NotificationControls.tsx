"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import { ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { retryDeliveryAction, saveNotificationTemplateAction, saveSubscriptionConditionsAction } from "./actions";

const priorities = [
  { value: "low", label: "منخفضة" },
  { value: "normal", label: "عادية" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];

export function TemplateEditButton({ eventType, language, initial }: { eventType: string; language: "ar" | "en"; initial: { title: string; body: string | null; priority: string; is_active: boolean } | null }) {
  return (
    <ModalButton label={initial ? "تعديل" : "+ قالب"} title={`${eventType} — ${language === "ar" ? "العربية" : "English"}`} className={initial ? "admin-btn small ghost" : "admin-btn small secondary"}>
      {(close) => (
        <ActionForm action={saveNotificationTemplateAction} onSuccess={close} successMessage="تم الحفظ">
          <input type="hidden" name="event_type" value={eventType} />
          <input type="hidden" name="language" value={language} />
          <TextField name="title" label="العنوان" defaultValue={initial?.title ?? ""} required dir={language === "ar" ? "rtl" : "ltr"} hint="متغيرات: {{entity.name}} {{entity.title}} {{payload.title}} {{summary}}" />
          <TextAreaField name="body" label="النص" defaultValue={initial?.body ?? ""} dir={language === "ar" ? "rtl" : "ltr"} />
          <div className="bos-form-grid">
            <SelectField name="priority" label="الأولوية" options={priorities} defaultValue={initial?.priority ?? "normal"} />
            <CheckboxField name="is_active" label="مفعّل" defaultChecked={initial?.is_active ?? true} />
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ConditionsButton({ id, initial }: { id: string; initial: unknown[] }) {
  const t = useT();
  const router = useRouter();
  const [json, setJson] = useState(initial.length ? JSON.stringify(initial, null, 2) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <ModalButton label={initial.length ? t("شروط ({n})", { n: initial.length }) : t("شروط")} title="شروط الاشتراك" className="admin-btn small ghost">
      {() => (
        <div className="bos-stack">
          <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>يُرسل الإشعار فقط عند تحقق كل الشروط. نفس صيغة شروط مسارات العمل.</Tx></p>
          <textarea className="bos-code" dir="ltr" rows={8} value={json} onChange={(e) => setJson(e.target.value)} placeholder='[{"field":"entity.priority","op":"eq","value":"urgent"}]' />
          {msg ? <div className={msg.ok ? "bos-form-success" : "bos-form-error"}><Tx>{msg.text}</Tx></div> : null}
          <div className="bos-form-actions">
            <button type="button" className="admin-btn" disabled={pending} onClick={() => start(async () => {
              const r = await saveSubscriptionConditionsAction(id, json);
              setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
              if (r.ok) router.refresh();
            })}><Tx>حفظ</Tx></button>
          </div>
        </div>
      )}
    </ModalButton>
  );
}

export function RetryDeliveryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="bos-row" style={{ gap: 6 }}>
      <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => start(async () => {
        const r = await retryDeliveryAction(id);
        setMsg(r.ok ? r.message ?? "" : r.error);
        router.refresh();
      })}><Tx>{pending ? "..." : "إعادة المحاولة"}</Tx></button>
      {msg ? <span className="bos-faint" style={{ fontSize: 11.5 }}><Tx>{msg}</Tx></span> : null}
    </span>
  );
}
