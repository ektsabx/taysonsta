"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, Opt, useT } from "@/components/bos/I18n";
import { ModalButton, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { resubmitApprovalAction } from "@/app/admin/_actions/common";
import { createDelegationAction, endDelegationAction } from "./actions";

type O = { value: string; label: string };

export function ResubmitButton({ approvalId }: { approvalId: string }) {
  const t = useT();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <ModalButton label="إعادة التقديم" title="إعادة تقديم الطلب بعد التعديل" className="admin-btn small">
      {(close) => (
        <div className="bos-stack">
          <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>عدّل السجل الأصلي أولاً إن لزم، ثم أعد التقديم — يبدأ الطلب من الخطوة الأولى كنسخة جديدة ويبقى السجل السابق.</Tx></p>
          <div className="bos-field"><label><Tx>ما الذي تم تعديله؟</Tx></label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("اختياري")} /></div>
          {err ? <div className="bos-form-error"><Tx>{err}</Tx></div> : null}
          <div className="bos-form-actions">
            <button type="button" className="admin-btn" disabled={pending} onClick={() => start(async () => {
              const r = await resubmitApprovalAction(approvalId, note);
              if (r.ok) { close(); router.refresh(); } else setErr(r.error);
            })}><Tx>{pending ? "جارٍ الإرسال..." : "إعادة التقديم"}</Tx></button>
          </div>
        </div>
      )}
    </ModalButton>
  );
}

export function DelegationButton({ staff, forOthers, types }: { staff: O[]; forOthers: O[] | null; types: O[] }) {
  return (
    <ModalButton label="+ تفويض" title="تفويض الموافقات لموافِق بديل" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={createDelegationAction} onSuccess={close} successMessage="تم إنشاء التفويض">
          <div className="bos-form-grid">
            {forOthers ? <SelectField name="user_id" label="المفوِّض (فارغ = أنا)" placeholder="—" options={forOthers} /> : null}
            <SelectField name="delegate_user_id" label="المفوَّض إليه" options={staff} required />
            <TextField name="starts_on" label="من" type="date" required />
            <TextField name="ends_on" label="إلى" type="date" required />
            <div className="bos-field span-all">
              <label><Tx>الأنواع (بدون اختيار = كل الأنواع)</Tx></label>
              <select name="approval_types[]" multiple style={{ minHeight: 110 }}>{types.map((t) => <Opt key={t.value} value={t.value}>{t.label}</Opt>)}</select>
            </div>
            <TextField name="reason" label="السبب" span="all" placeholder="مثال: إجازة سنوية" />
          </div>
          <div className="bos-form-actions"><SubmitButton label="تفويض" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function EndDelegationButton({ id }: { id: string }) {
  return <ConfirmButton label="إنهاء" className="admin-btn small ghost" title="إنهاء التفويض" message="تعود الطلبات الجديدة إلى الموافِق الأصلي." confirmLabel="إنهاء" action={() => endDelegationAction(id)} />;
}
