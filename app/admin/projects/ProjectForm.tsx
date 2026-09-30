"use client";

import { useT } from "@/components/bos/I18n";

import { useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, Field, FormSection, MoneyField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";

export function ProjectForm({
  action,
  currencies,
  staff,
  initial = {},
  initialClient = null,
  initialContact = null,
  canEditBudget,
  canAssign,
  submitLabel = "حفظ",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  currencies: string[];
  staff: { value: string; label: string }[];
  initial?: { name?: string; budget?: string; currency?: string; scope?: string | null; start_date?: string | null; deadline?: string | null; pm_id?: string | null };
  initialClient?: EntityOption | null;
  initialContact?: EntityOption | null;
  canEditBudget: boolean;
  canAssign: boolean;
  submitLabel?: string;
}) {
  const t = useT();
  const [client, setClient] = useState<EntityOption | null>(initialClient);
  return (
    <ActionForm action={action} successMessage="تم الحفظ">
      <FormSection title="المشروع">
        <TextField name="name" label="اسم المشروع" required defaultValue={initial.name ?? ""} span={2} />
        <Field label="العميل" name="client_id" required span={2}>
          <EntitySelector name="client_id" required initial={initialClient} onChange={setClient} search={(q) => searchEntitiesAction("client", q)} />
        </Field>
        <Field label="جهة الاتصال الأساسية" name="primary_contact_id" span={2}>
          {client ? <EntitySelector key={client.id} name="primary_contact_id" initial={initialContact} search={(q) => searchEntitiesAction("contact", q, { client_id: client.id })} /> : <input disabled placeholder={t("اختر العميل أولاً")} />}
        </Field>
        {canAssign ? <SelectField name="pm_id" label="مدير المشروع" options={staff} placeholder="—" defaultValue={initial.pm_id ?? ""} /> : <input type="hidden" name="pm_id" value={initial.pm_id ?? ""} />}
        {canEditBudget ? (
          <MoneyField name="budget" currencyName="currency" label="الميزانية" currencies={currencies} defaultValue={initial.budget ?? ""} defaultCurrency={initial.currency ?? "USD"} />
        ) : (
          <>
            <input type="hidden" name="budget" value={initial.budget ?? "0"} />
            <input type="hidden" name="currency" value={initial.currency ?? "USD"} />
          </>
        )}
        <TextField name="start_date" label="تاريخ البداية" type="date" defaultValue={initial.start_date ?? ""} />
        <TextField name="deadline" label="الموعد النهائي" type="date" defaultValue={initial.deadline ?? ""} />
        <TextAreaField name="scope" label="النطاق" defaultValue={initial.scope ?? ""} rows={6} hint="تعديلات النطاق والميزانية بعد البدء تتم عبر طلبات التغيير." />
      </FormSection>
      <div className="bos-form-actions">
        <SubmitButton label={submitLabel} />
      </div>
    </ActionForm>
  );
}
