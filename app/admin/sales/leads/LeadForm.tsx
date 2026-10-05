"use client";

import { Tx } from "@/components/bos/I18n";

import { useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, FormSection, MoneyField, SelectField, SubmitButton, TextAreaField, TextField, CheckboxField } from "@/components/bos/Form";

export interface LeadFormValues {
  name?: string;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  industry?: string | null;
  source_id?: string | null;
  estimated_budget?: string | number | null;
  budget_currency?: string | null;
  business_stage?: string | null;
  timeline?: string | null;
  decision_maker?: string | null;
  current_solution?: string | null;
  problem?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  team_id?: string | null;
  priority?: string;
  budget_score?: number;
  fit_score?: number;
  intent_score?: number;
  engagement_score?: number;
}

interface Option {
  value: string;
  label: string;
}

const businessStages: Option[] = [
  { value: "idea", label: "فكرة" },
  { value: "early", label: "مرحلة مبكرة" },
  { value: "growing", label: "نمو" },
  { value: "established", label: "راسخ" },
];

function ScoreInput({ name, label, value, onChange }: { name: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="bos-field">
      <label htmlFor={`f-${name}`}>
        <Tx>{label}</Tx> <span className="bos-faint">(0–25)</span>
      </label>
      <input id={`f-${name}`} name={name} type="number" min={0} max={25} step={1} value={value} onChange={(e) => onChange(Math.max(0, Math.min(25, Number(e.target.value) || 0)))} />
    </div>
  );
}

export function LeadForm({
  action,
  initial = {},
  sources,
  staff,
  teams,
  currencies,
  canAssign,
  canAllowDuplicate,
  submitLabel = "حفظ",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: LeadFormValues;
  sources: Option[];
  staff: Option[];
  teams: Option[];
  currencies: string[];
  canAssign: boolean;
  canAllowDuplicate: boolean;
  submitLabel?: string;
}) {
  const [scores, setScores] = useState({
    budget_score: initial.budget_score ?? 0,
    fit_score: initial.fit_score ?? 0,
    intent_score: initial.intent_score ?? 0,
    engagement_score: initial.engagement_score ?? 0,
  });
  const total = scores.budget_score + scores.fit_score + scores.intent_score + scores.engagement_score;

  return (
    <ActionForm action={action} successMessage="تم الحفظ">
      <FormSection title="البيانات الأساسية">
        <TextField name="name" label="اسم العميل المحتمل" required defaultValue={initial.name ?? ""} maxLength={200} />
        <TextField name="company_name" label="الشركة" defaultValue={initial.company_name ?? ""} />
        <TextField name="contact_name" label="اسم جهة الاتصال" defaultValue={initial.contact_name ?? ""} />
        <TextField name="email" label="البريد الإلكتروني" type="email" defaultValue={initial.email ?? ""} hint="يُستخدم لمنع التكرار" />
        <TextField name="phone" label="الهاتف" defaultValue={initial.phone ?? ""} />
        <TextField name="website" label="الموقع الإلكتروني" defaultValue={initial.website ?? ""} placeholder="https://" />
        <TextField name="country" label="الدولة" defaultValue={initial.country ?? ""} list="bos-countries" />
        <TextField name="city" label="المدينة" defaultValue={initial.city ?? ""} />
        <TextField name="industry" label="القطاع" defaultValue={initial.industry ?? ""} />
        <datalist id="bos-countries">
          {["Egypt", "Saudi Arabia", "UAE", "Kuwait", "Qatar", "Bahrain", "Oman", "Germany", "United Kingdom", "United States"].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </FormSection>

      <FormSection title="التأهيل">
        <SelectField name="source_id" label="مصدر العميل" options={sources} placeholder="—" defaultValue={initial.source_id ?? ""} />
        <MoneyField name="estimated_budget" currencyName="budget_currency" label="الميزانية التقديرية" currencies={currencies} defaultValue={initial.estimated_budget ?? ""} defaultCurrency={initial.budget_currency ?? "USD"} />
        <SelectField name="business_stage" label="مرحلة العمل" options={businessStages} placeholder="—" defaultValue={initial.business_stage ?? ""} />
        <TextField name="timeline" label="الإطار الزمني" defaultValue={initial.timeline ?? ""} placeholder="مثال: خلال 3 أشهر" />
        <TextField name="decision_maker" label="صاحب القرار" defaultValue={initial.decision_maker ?? ""} />
        <TextAreaField name="current_solution" label="الحل الحالي" defaultValue={initial.current_solution ?? ""} span={2} />
        <TextAreaField name="problem" label="المشكلة / الفرصة" defaultValue={initial.problem ?? ""} span={2} />
        <TextAreaField name="notes" label="ملاحظات" defaultValue={initial.notes ?? ""} />
      </FormSection>

      <FormSection title="التعيين">
        {canAssign ? (
          <SelectField name="assigned_to" label="المسؤول (BD)" options={staff} placeholder="غير معيّن — يُوزع تلقائياً" defaultValue={initial.assigned_to ?? ""} />
        ) : (
          <input type="hidden" name="assigned_to" value={initial.assigned_to ?? ""} />
        )}
        <SelectField name="team_id" label="الفريق" options={teams} placeholder="—" defaultValue={initial.team_id ?? ""} />
        <SelectField
          name="priority"
          label="الأولوية"
          options={[
            { value: "low", label: "منخفضة" },
            { value: "medium", label: "متوسطة" },
            { value: "high", label: "عالية" },
            { value: "urgent", label: "عاجلة" },
          ]}
          defaultValue={initial.priority ?? "medium"}
        />
      </FormSection>

      <FormSection title={`التقييم — الإجمالي ${total}/100`}>
        <ScoreInput name="budget_score" label="الميزانية" value={scores.budget_score} onChange={(v) => setScores((s) => ({ ...s, budget_score: v }))} />
        <ScoreInput name="fit_score" label="الملاءمة" value={scores.fit_score} onChange={(v) => setScores((s) => ({ ...s, fit_score: v }))} />
        <ScoreInput name="intent_score" label="النية" value={scores.intent_score} onChange={(v) => setScores((s) => ({ ...s, intent_score: v }))} />
        <ScoreInput name="engagement_score" label="التفاعل" value={scores.engagement_score} onChange={(v) => setScores((s) => ({ ...s, engagement_score: v }))} />
        <div className="bos-field span-all">
          <div className="bos-progress">
            <span style={{ width: `${total}%` }} />
          </div>
        </div>
      </FormSection>

      {canAllowDuplicate ? <CheckboxField name="allow_duplicate" label="السماح بالإنشاء رغم وجود بريد مكرر (سيُحفظ بدون بريد)" /> : null}

      <div className="bos-form-actions">
        <SubmitButton label={submitLabel} />
      </div>
    </ActionForm>
  );
}
