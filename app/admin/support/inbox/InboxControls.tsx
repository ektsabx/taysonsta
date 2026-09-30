"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { ModalButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { myAvailabilityAction, newConversationAction } from "./actions";

type O = { value: string; label: string };

// Keeps the inbox fresh (new customer messages) without a manual reload.
export function LiveRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function NewConversationButton({ teams }: { teams: O[] }) {
  const router = useRouter();
  return (
    <ModalButton label="+ محادثة" title="تسجيل محادثة جديدة" className="admin-btn small">
      {(close) => (
        <ActionForm action={newConversationAction} onSuccess={(s) => { close(); const d = (s as { data?: { id: string } }).data; if (d) router.push(`/admin/support/inbox?c=${d.id}`); }} successMessage="تم الإنشاء">
          <div className="bos-form-grid">
            <SelectField name="channel" label="القناة" defaultValue="phone" options={[{ value: "phone", label: "مكالمة" }, { value: "email", label: "بريد" }, { value: "whatsapp", label: "واتساب" }, { value: "sms", label: "SMS" }, { value: "manual", label: "أخرى" }]} />
            <SelectField name="priority" label="الأولوية" defaultValue="normal" options={[{ value: "low", label: "منخفضة" }, { value: "normal", label: "عادية" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }]} />
            <TextField name="name" label="اسم العميل" />
            <TextField name="email" label="البريد" type="email" dir="ltr" />
            <TextField name="phone" label="الهاتف" dir="ltr" />
            <TextField name="company" label="الشركة" />
            <SelectField name="team_id" label="الفريق" placeholder="الافتراضي" options={teams} />
            <TextField name="subject" label="الموضوع" />
          </div>
          <TextAreaField name="body" label="رسالة العميل / ملخص المكالمة" required />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>يُربط العميل تلقائياً بملفه إن وُجد (نفس البريد أو الهاتف) ويُسند للفريق حسب قاعدة التوزيع.</Tx></p>
          <div className="bos-form-actions"><SubmitButton label="إنشاء" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function AvailabilityToggle({ available }: { available: boolean | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (available === null) return null;
  return (
    <button type="button" className={`admin-btn small ${available ? "success" : "ghost"}`} disabled={pending} onClick={() => start(async () => { await myAvailabilityAction(!available); router.refresh(); })}>
      <Tx>{available ? "● متاح" : "○ غير متاح"}</Tx>
    </button>
  );
}
