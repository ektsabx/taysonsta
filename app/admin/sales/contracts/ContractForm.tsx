"use client";

import { useT } from "@/components/bos/I18n";

import { useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, Field, FormSection, MoneyField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";

export function ContractForm({
  action,
  currencies,
  initial,
  initialClient,
  initialDeal,
  proposalId,
  submitLabel = "حفظ",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  currencies: string[];
  initial: { title?: string; value?: string; currency?: string; start_date?: string | null; end_date?: string | null; payment_terms?: string | null; required_signers?: number };
  initialClient: EntityOption | null;
  initialDeal: EntityOption | null;
  proposalId?: string | null;
  submitLabel?: string;
}) {
  const t = useT();
  const [client, setClient] = useState<EntityOption | null>(initialClient);
  return (
    <ActionForm action={action} successMessage="تم الحفظ">
      {proposalId ? <input type="hidden" name="proposal_id" value={proposalId} /> : null}
      <FormSection title="العقد">
        <TextField name="title" label="عنوان العقد" required defaultValue={initial.title ?? ""} span={2} />
        <Field label="الحساب" name="client_id" required span={2}>
          <EntitySelector name="client_id" required initial={initialClient} onChange={setClient} search={(q) => searchEntitiesAction("client", q)} />
        </Field>
        <Field label="الصفقة" name="deal_id" span={2}>
          {client ? <EntitySelector key={client.id} name="deal_id" initial={initialDeal} search={(q) => searchEntitiesAction("deal", q, { client_id: client.id })} placeholder="اربط العقد بالصفقة" /> : <input disabled placeholder={t("اختر الحساب أولاً")} />}
        </Field>
        <MoneyField name="value" currencyName="currency" label="قيمة العقد" required currencies={currencies} defaultValue={initial.value ?? ""} defaultCurrency={initial.currency ?? "USD"} />
        <TextField name="start_date" label="تاريخ البداية" type="date" defaultValue={initial.start_date ?? ""} />
        <TextField name="end_date" label="تاريخ النهاية" type="date" defaultValue={initial.end_date ?? ""} />
        <TextField name="required_signers" label="عدد الموقعين المطلوب" type="number" min={1} max={10} defaultValue={String(initial.required_signers ?? 1)} />
        <TextAreaField name="payment_terms" label="شروط الدفع" defaultValue={initial.payment_terms ?? ""} />
      </FormSection>
      <div className="bos-form-actions">
        <SubmitButton label={submitLabel} />
      </div>
    </ActionForm>
  );
}
