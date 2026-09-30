"use client";

import { Tx } from "@/components/bos/I18n";

import type { ActionState } from "@/lib/bos/action";
import { ActionForm, CheckboxField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { ModalButton } from "@/components/bos/Dialog";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { createContactAction, updateContactAction } from "@/app/admin/clients/actions";

export interface ContactFormValues {
  id?: string;
  client_id?: string | null;
  full_name?: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  linkedin_url?: string | null;
  is_decision_maker?: boolean;
  notes?: string | null;
  isPrimary?: boolean;
}

function ContactFields({ initial, account, lockAccount, onDone }: { initial: ContactFormValues; account?: EntityOption | null; lockAccount?: boolean; onDone: () => void }) {
  const action: (s: ActionState, f: FormData) => Promise<ActionState> = initial.id ? updateContactAction.bind(null, initial.id) : createContactAction;
  return (
    <ActionForm action={action} onSuccess={onDone} successMessage={initial.id ? "تم الحفظ" : "تمت الإضافة"}>
      <div className="bos-form-grid">
        {lockAccount ? (
          <input type="hidden" name="client_id" value={initial.client_id ?? ""} />
        ) : (
          <div className="bos-field" style={{ gridColumn: "1 / -1" }}>
            <label><Tx>الحساب</Tx></label>
            <EntitySelector name="client_id" search={(q) => searchEntitiesAction("client", q)} initial={account ?? null} placeholder="ابحث عن الحساب..." />
          </div>
        )}
        <TextField name="full_name" label="الاسم" required defaultValue={initial.full_name ?? ""} />
        <TextField name="position" label="المنصب" defaultValue={initial.position ?? ""} />
        <TextField name="email" label="البريد الإلكتروني" type="email" defaultValue={initial.email ?? ""} dir="ltr" />
        <TextField name="phone" label="الهاتف" defaultValue={initial.phone ?? ""} dir="ltr" />
        <TextField name="whatsapp" label="واتساب" defaultValue={initial.whatsapp ?? ""} dir="ltr" />
        <TextField name="linkedin_url" label="لينكدإن" defaultValue={initial.linkedin_url ?? ""} dir="ltr" />
        <TextAreaField name="notes" label="ملاحظات" defaultValue={initial.notes ?? ""} rows={3} span="all" />
      </div>
      <CheckboxField name="is_decision_maker" label="صاحب قرار" defaultChecked={initial.is_decision_maker} />
      <CheckboxField name="make_primary" label="جهة الاتصال الرئيسية للحساب" defaultChecked={initial.isPrimary} />
      <div className="bos-form-actions">
        <SubmitButton label={initial.id ? "حفظ" : "إضافة جهة الاتصال"} />
      </div>
    </ActionForm>
  );
}

export function ContactModalButton({
  initial = {},
  account,
  lockAccount,
  label = "+ جهة اتصال",
  className = "admin-btn small secondary",
}: {
  initial?: ContactFormValues;
  account?: EntityOption | null;
  lockAccount?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <ModalButton label={label} title={initial.id ? "تعديل جهة الاتصال" : "جهة اتصال جديدة"} className={className} wide>
      {(close) => <ContactFields initial={initial} account={account} lockAccount={lockAccount} onDone={close} />}
    </ModalButton>
  );
}
