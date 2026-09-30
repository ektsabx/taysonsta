"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import { ModalButton, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { linkCustomerAction, mergeCustomerAction, saveCustomerAction } from "../../inbox/actions";

type O = { value: string; label: string };

export function CustomerEditButton({ customer, staff }: { customer: { id: string; name: string; email: string | null; phone: string | null; whatsapp: string | null; company: string | null; country: string | null; priority: string; tags: string; notes: string | null; owner_id: string | null }; staff: O[] }) {
  return (
    <ModalButton label="تعديل" title="بيانات العميل" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={saveCustomerAction} onSuccess={close} successMessage="تم الحفظ">
          <input type="hidden" name="id" value={customer.id} />
          <div className="bos-form-grid">
            <TextField name="name" label="الاسم" defaultValue={customer.name} required />
            <TextField name="email" label="البريد" type="email" dir="ltr" defaultValue={customer.email ?? ""} />
            <TextField name="phone" label="الهاتف" dir="ltr" defaultValue={customer.phone ?? ""} />
            <TextField name="whatsapp" label="واتساب" dir="ltr" defaultValue={customer.whatsapp ?? ""} />
            <TextField name="company" label="الشركة" defaultValue={customer.company ?? ""} />
            <TextField name="country" label="الدولة" defaultValue={customer.country ?? ""} />
            <SelectField name="priority" label="الأولوية" defaultValue={customer.priority} options={[{ value: "low", label: "منخفضة" }, { value: "normal", label: "عادية" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }]} />
            <SelectField name="owner_id" label="المسؤول" placeholder="—" defaultValue={customer.owner_id ?? ""} options={staff} />
            <TextField name="tags" label="الوسوم (مفصولة بفواصل)" defaultValue={customer.tags} span="all" />
          </div>
          <TextAreaField name="notes" label="ملاحظات الدعم" defaultValue={customer.notes ?? ""} />
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

// Link to an existing CRM contact (and its account).
export function CustomerLinkControls({ id, contactLabel, clientLabel }: { id: string; contactLabel: string | null; clientLabel: string | null }) {
  const router = useRouter();
  const [contact, setContact] = useState<EntityOption | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="bos-row" style={{ gap: 8, alignItems: "flex-end" }}>
      <div className="bos-field" style={{ minWidth: 260 }}>
        <label><Tx>ربط بجهة اتصال في CRM</Tx></label>
        <EntitySelector name="contact_id" search={(q) => searchEntitiesAction("contact", q)} initial={null} onChange={setContact} placeholder={contactLabel ?? clientLabel ?? "ابحث عن جهة اتصال..."} />
      </div>
      <button type="button" className="admin-btn small secondary" disabled={pending || !contact} onClick={() => start(async () => {
        const r = await linkCustomerAction(id, contact!.id, null);
        setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
        router.refresh();
      })}><Tx>ربط</Tx></button>
      {contactLabel ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => start(async () => { await linkCustomerAction(id, null, null); router.refresh(); })}><Tx>إلغاء الربط</Tx></button> : null}
      {msg ? <span className={msg.ok ? "bos-success" : "bos-field-error"} style={{ fontSize: 12 }}><Tx>{msg.text}</Tx></span> : null}
    </div>
  );
}

export function MergeCustomerButton({ sourceId, targetId, sourceName }: { sourceId: string; targetId: string; sourceName: string }) {
  const t = useT();
  return <ConfirmButton label="دمج في هذا الملف" className="admin-btn small ghost" title="دمج ملفي العميل" message={t("تنتقل محادثات وتذاكر «{name}» إلى هذا الملف ويُعلَّم الملف الآخر كمدموج. لا يُحذف شيء.", { name: sourceName })} confirmLabel="دمج" action={() => mergeCustomerAction(sourceId, targetId)} />;
}
