"use client";

import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { saveVendorAction } from "../actions";

export function VendorForm({ vendorId, initial = {} }: { vendorId: string | null; initial?: Record<string, string | null> }) {
  return (
    <ActionForm action={saveVendorAction.bind(null, vendorId)} successMessage="تم الحفظ" guardUnsaved={false}>
      <div className="bos-form-grid">
        <TextField name="name" label="اسم المورد" required defaultValue={initial.name ?? ""} />
        <TextField name="type" label="النوع" defaultValue={initial.type ?? ""} placeholder="استضافة، مستقل، برمجيات..." />
        <TextField name="contact_name" label="جهة الاتصال" defaultValue={initial.contact_name ?? ""} />
        <TextField name="email" label="البريد" type="email" defaultValue={initial.email ?? ""} />
        <TextField name="phone" label="الهاتف" defaultValue={initial.phone ?? ""} />
        <TextAreaField name="services" label="الخدمات" defaultValue={initial.services ?? ""} />
        <TextAreaField name="notes" label="ملاحظات" defaultValue={initial.notes ?? ""} />
      </div>
      <div className="bos-form-actions">
        <SubmitButton />
      </div>
    </ActionForm>
  );
}
