"use client";

import { Tx } from "@/components/bos/I18n";

import { useState } from "react";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { ModalButton } from "@/components/bos/Dialog";
import { kpiMetrics } from "@/lib/bos/kpi-metrics";
import { saveKpiAction } from "../actions";

type Opt = { value: string; label: string };

export interface KpiValues {
  id?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  role_id?: string | null;
  department_id?: string | null;
  owner_id?: string | null;
  data_source?: string;
  calculation?: string;
  unit?: string;
  direction?: string;
  target?: number | string;
  period?: string;
  weight?: number | string | null;
  weight_enabled?: boolean;
  is_active?: boolean;
}

export function KpiModalButton({ initial = {}, roles, departments, staff, label }: { initial?: KpiValues; roles: Opt[]; departments: Opt[]; staff: Opt[]; label?: string }) {
  const [source, setSource] = useState(initial.data_source ?? "leads.qualified_count");
  const [weighted, setWeighted] = useState(initial.weight_enabled ?? false);
  const metric = kpiMetrics.find((m) => m.key === source);
  return (
    <ModalButton label={label ?? (initial.id ? "تعديل" : "+ مؤشر")} title={initial.id ? "تعديل مؤشر الأداء" : "مؤشر أداء جديد"} className={initial.id ? "admin-btn small ghost" : "admin-btn small"} wide>
      {(close) => (
        <ActionForm action={saveKpiAction.bind(null, initial.id ?? null)} onSuccess={close}>
          <div className="bos-form-grid">
            <TextField name="name" label="الاسم" required defaultValue={initial.name ?? ""} />
            <TextField name="category" label="الفئة" defaultValue={initial.category ?? ""} placeholder="Sales / Delivery / ..." />
            <SelectField name="data_source" label="مصدر البيانات" options={kpiMetrics.map((m) => ({ value: m.key, label: m.label }))} value={source} onChange={(e) => setSource(e.target.value)} />
            <SelectField name="calculation" label="طريقة الحساب" options={[{ value: "count", label: "عدد" }, { value: "sum", label: "مجموع" }, { value: "avg", label: "متوسط" }, { value: "ratio", label: "نسبة" }, { value: "manual", label: "يدوي" }]} defaultValue={initial.calculation ?? metric?.calculation ?? "count"} key={`c-${source}`} />
            <SelectField name="unit" label="الوحدة" options={[{ value: "count", label: "عدد" }, { value: "currency", label: "مبلغ" }, { value: "percent", label: "%" }, { value: "hours", label: "ساعات" }, { value: "score", label: "درجة" }]} defaultValue={initial.unit ?? metric?.unit ?? "count"} key={`u-${source}`} />
            <SelectField name="direction" label="الاتجاه" options={[{ value: "higher_better", label: "الأعلى أفضل" }, { value: "lower_better", label: "الأقل أفضل" }]} defaultValue={initial.direction ?? metric?.direction ?? "higher_better"} key={`d-${source}`} />
            <TextField name="target" label="المستهدف" required inputMode="decimal" defaultValue={String(initial.target ?? "")} />
            <SelectField name="period" label="فترة القياس" options={[{ value: "weekly", label: "أسبوعي" }, { value: "monthly", label: "شهري" }, { value: "quarterly", label: "ربع سنوي" }, { value: "yearly", label: "سنوي" }]} defaultValue={initial.period ?? "monthly"} />
            <SelectField name="role_id" label="الدور" placeholder="— (تخصيص يدوي)" options={roles} defaultValue={initial.role_id ?? ""} />
            <SelectField name="department_id" label="القسم" placeholder="—" options={departments} defaultValue={initial.department_id ?? ""} />
            <SelectField name="owner_id" label="المسؤول عن المؤشر" placeholder="—" options={staff} defaultValue={initial.owner_id ?? ""} />
            {weighted ? <TextField name="weight" label="الوزن %" type="number" min={0} max={100} defaultValue={String(initial.weight ?? "")} /> : <input type="hidden" name="weight" value="" />}
            <TextAreaField name="description" label="الوصف" rows={2} defaultValue={initial.description ?? ""} />
          </div>
          <label className="bos-check"><input type="checkbox" name="weight_enabled" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} /> <Tx>تفعيل الأوزان (مجموع أوزان الدور لا يتجاوز 100%)</Tx></label>
          <CheckboxField name="is_active" label="نشط" defaultChecked={initial.is_active ?? true} />
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}
