"use client";

import { Tx } from "@/components/bos/I18n";

import { useState } from "react";
import { ActionButton, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { cancelContractAction, markContractViewedAction, recordSignatureAction, sendContractAction, adoptLatestFileAsDocumentAction } from "../actions";

export function ContractActions({ contractId, status, hasFile }: { contractId: string; status: string; hasFile: boolean }) {
  return (
    <>
      {!["signed", "cancelled", "expired"].includes(status) ? (
        <ActionButton label="اعتماد آخر ملف كنسخة العقد" className="admin-btn small secondary" action={() => adoptLatestFileAsDocumentAction(contractId)} />
      ) : null}
      {status === "draft" ? <ActionButton label={hasFile ? "إرسال للتوقيع" : "إرسال للتوقيع (يتطلب ملف العقد)"} className="admin-btn small" action={() => sendContractAction(contractId)} /> : null}
      {status === "sent" ? <ActionButton label="تسجيل المشاهدة" className="admin-btn small ghost" action={() => markContractViewedAction(contractId)} /> : null}
      {!["cancelled", "expired", "signed"].includes(status) ? (
        <ConfirmButton label="إلغاء العقد" className="admin-btn small danger" message="إلغاء هذا العقد؟ سيبقى في السجل." requireReason action={(reason) => cancelContractAction(contractId, reason)} />
      ) : null}
    </>
  );
}

export function SignatureForm({ contractId, contacts }: { contractId: string; contacts: { value: string; label: string; email: string | null }[] }) {
  const [contactId, setContactId] = useState("");
  const selected = contacts.find((c) => c.value === contactId);
  return (
    <ActionForm action={recordSignatureAction.bind(null, contractId)} resetOnSuccess guardUnsaved={false}>
      <h3 style={{ fontSize: 13, fontWeight: 800 }}><Tx>تسجيل توقيع</Tx></h3>
      <div className="bos-form-grid">
        <SelectField name="contact_id" label="جهة الاتصال (اختياري)" options={contacts.map((c) => ({ value: c.value, label: c.label }))} placeholder="—" value={contactId} onChange={(e) => setContactId(e.target.value)} />
        <TextField name="signer_name" label="اسم الموقّع" required key={`n-${contactId}`} defaultValue={selected?.label ?? ""} />
        <TextField name="signer_email" label="بريد الموقّع" type="email" key={`e-${contactId}`} defaultValue={selected?.email ?? ""} />
        <SelectField
          name="method"
          label="طريقة التوقيع"
          options={[
            { value: "manual", label: "مستند موقّع (مرفوع)" },
            { value: "click", label: "موافقة إلكترونية" },
            { value: "esign", label: "مزود توقيع إلكتروني" },
          ]}
          defaultValue="manual"
        />
        <TextField name="provider_reference" label="مرجع مزود التوقيع" />
        <TextField name="signer_ip" label="IP الموقّع (من شهادة التوقيع إن وُجد)" />
      </div>
      <div className="bos-form-actions">
        <SubmitButton label="تسجيل التوقيع" />
      </div>
    </ActionForm>
  );
}
