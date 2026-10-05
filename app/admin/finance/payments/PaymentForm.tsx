"use client";


import { useMemo, useState } from "react";
import { ActionForm, Field, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { recordPaymentAction } from "../actions";
import { statusOptions } from "@/lib/bos/labels";

export interface OpenInvoice {
  id: string;
  number: string;
  currency: string;
  balance: string;
  client_id: string;
  deal_id: string | null;
}

// Record Payment (§18). The idempotency key is generated once per form so a
// double click or retry can never create two payments.
export function PaymentForm({
  currencies,
  initialClient,
  openInvoices,
  preselectedInvoiceId,
  today,
}: {
  currencies: string[];
  initialClient: EntityOption | null;
  openInvoices: OpenInvoice[];
  preselectedInvoiceId?: string | null;
  today: string;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [client, setClient] = useState<EntityOption | null>(initialClient);
  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId ?? "");
  const invoices = useMemo(() => openInvoices.filter((i) => !client || i.client_id === client.id), [openInvoices, client]);
  const invoice = invoices.find((i) => i.id === invoiceId);
  const [currency, setCurrency] = useState(invoice?.currency ?? "USD");
  const [amount, setAmount] = useState(invoice?.balance ?? "");

  return (
    <ActionForm action={recordPaymentAction} guardUnsaved>
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      {invoice?.deal_id ? <input type="hidden" name="deal_id" value={invoice.deal_id} /> : null}
      <FormSection title="الدفعة">
        <Field label="الحساب" name="client_id" required span={2}>
          <EntitySelector name="client_id" required initial={initialClient} onChange={(c) => { setClient(c); setInvoiceId(""); }} search={(q) => searchEntitiesAction("client", q)} />
        </Field>
        <SelectField
          name="invoice_id"
          label="الفاتورة"
          span={2}
          options={invoices.map((i) => ({ value: i.id, label: `${i.number} — متبقي ${i.balance} ${i.currency}` }))}
          placeholder={client ? (invoices.length ? "اختر الفاتورة" : "لا توجد فواتير مفتوحة لهذا الحساب") : "اختر الحساب أولاً"}
          value={invoiceId}
          onChange={(e) => {
            const inv = invoices.find((i) => i.id === e.target.value);
            setInvoiceId(e.target.value);
            if (inv) {
              setCurrency(inv.currency);
              setAmount(inv.balance);
            }
          }}
        />
        <Field label="المبلغ" name="amount" required>
          <div className="bos-input-group">
            <input id="f-amount" name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
            <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="العملة">
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </Field>
        <SelectField name="method" label="طريقة الدفع" options={statusOptions("payment_method")} defaultValue="bank_transfer" />
        <TextField name="payment_date" label="تاريخ الدفع" type="date" required defaultValue={today} />
        <TextField name="reference" label="المرجع (رقم التحويل)" hint="يُمنع تكرار نفس المرجع على نفس الفاتورة" />
        <SelectField
          name="status"
          label="الحالة"
          options={[
            { value: "completed", label: "مكتملة (تم الاستلام)" },
            { value: "processing", label: "قيد المعالجة" },
            { value: "pending", label: "قيد الانتظار" },
          ]}
          defaultValue="completed"
        />
        <TextAreaField name="notes" label="ملاحظات" />
      </FormSection>
      <div className="bos-form-actions">
        <SubmitButton label="تسجيل الدفعة" pendingLabel="جارٍ التسجيل..." />
      </div>
    </ActionForm>
  );
}
