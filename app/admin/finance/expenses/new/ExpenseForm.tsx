"use client";

import { Tx } from "@/components/bos/I18n";

import { ActionForm, Field, FormSection, MoneyField, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { EntitySelector } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { createExpenseAction } from "../../actions";

export function ExpenseForm({
  currencies,
  categories,
  staff,
  today,
}: {
  currencies: string[];
  categories: { value: string; label: string }[];
  staff: { value: string; label: string }[];
  today: string;
}) {
  return (
    <ActionForm action={createExpenseAction}>
      <FormSection title="المصروف">
        <TextField name="description" label="الوصف" required span={2} />
        <SelectField name="category_id" label="الفئة" required options={categories} placeholder="اختر" />
        <MoneyField name="amount" currencyName="currency" label="المبلغ" required currencies={currencies} />
        <TextField name="expense_date" label="التاريخ" type="date" required defaultValue={today} />
        <Field label="المورد" name="vendor_id">
          <EntitySelector name="vendor_id" search={(q) => searchEntitiesAction("vendor", q)} placeholder="اختياري" />
        </Field>
        <SelectField name="employee_user_id" label="الموظف (إن كان مصروف موظف)" options={staff} placeholder="—" />
      </FormSection>
      <p className="bos-hint"><Tx>بعد الحفظ ارفع الإيصال من صفحة المصروف. يُرسل للموافقة حسب سياسة الشركة.</Tx></p>
      <div className="bos-form-actions">
        <SubmitButton label="حفظ المصروف" />
      </div>
    </ActionForm>
  );
}
