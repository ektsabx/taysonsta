"use client";

import { Tx } from "@/components/bos/I18n";

import { useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, CheckboxField, FormSection, MoneyField, SelectField, SubmitButton, TextField } from "@/components/bos/Form";

interface Option {
  value: string;
  label: string;
}

export interface EmployeeFormValues {
  full_name?: string;
  employee_code?: string | null;
  email?: string | null;
  personal_email?: string | null;
  phone?: string | null;
  position?: string | null;
  department_id?: string | null;
  team_id?: string | null;
  manager_id?: string | null;
  start_date?: string | null;
  employment_type?: string;
  work_schedule_id?: string | null;
  country?: string | null;
  timezone?: string;
  is_remote?: boolean;
  hourly_cost?: string | number | null;
  cost_currency?: string | null;
  role_ids?: string[];
  career_application_id?: string | null;
  work_location?: string | null;
  category_id?: string | null;
  probation_end_date?: string | null;
  probation_status?: string | null;
  skills?: string[] | null;
  certifications?: string | null;
  qualifications?: string | null;
  experience_years?: string | number | null;
  profile_notes?: string | null;
  hourly_cost_source?: string | null;
  branch_id?: string | null;
}

const probationOptions: Option[] = [
  { value: "none", label: "لا يوجد" },
  { value: "in_probation", label: "تحت الاختبار" },
  { value: "passed", label: "اجتاز" },
  { value: "extended", label: "تمديد" },
  { value: "failed", label: "لم يجتز" },
];

const employmentTypes: Option[] = [
  { value: "full_time", label: "دوام كامل" },
  { value: "part_time", label: "دوام جزئي" },
  { value: "contractor", label: "متعاقد" },
  { value: "intern", label: "متدرب" },
  { value: "freelancer", label: "مستقل" },
];

const commonTimezones = ["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Asia/Amman", "Europe/London", "Europe/Berlin", "America/New_York", "UTC"];

export function EmployeeForm({
  action,
  initial = {},
  departments,
  teams,
  managers,
  schedules,
  roles,
  currencies,
  canSensitive,
  canRoles,
  isNew,
  hasLogin,
  emailDomain,
  categories = [],
  branches = [],
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  initial?: EmployeeFormValues;
  departments: Option[];
  teams: (Option & { department_id: string | null })[];
  managers: Option[];
  schedules: Option[];
  roles: Option[];
  currencies: string[];
  canSensitive: boolean;
  canRoles: boolean;
  isNew?: boolean;
  hasLogin?: boolean;
  emailDomain?: string | null;
  categories?: Option[];
  branches?: Option[];
}) {
  const [dept, setDept] = useState(initial.department_id ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(initial.role_ids ?? []);
  const visibleTeams = teams.filter((t) => !dept || !t.department_id || t.department_id === dept);
  return (
    <ActionForm action={action}>
      {initial.career_application_id ? <input type="hidden" name="career_application_id" value={initial.career_application_id} /> : null}
      <FormSection title="البيانات الأساسية">
        <div className="bos-form-grid">
          <TextField name="full_name" label="الاسم الكامل" required defaultValue={initial.full_name ?? ""} />
          <TextField name="employee_code" label="كود الموظف" defaultValue={initial.employee_code ?? ""} />
          <TextField name="position" label="المسمى الوظيفي" defaultValue={initial.position ?? ""} />
          <TextField name="email" label="البريد الرسمي" type="email" dir="ltr" defaultValue={initial.email ?? ""} hint={emailDomain ? `على نطاق @${emailDomain}` : undefined} />
          <TextField name="personal_email" label="البريد الشخصي" type="email" dir="ltr" defaultValue={initial.personal_email ?? ""} />
          <TextField name="phone" label="الهاتف" dir="ltr" defaultValue={initial.phone ?? ""} />
        </div>
      </FormSection>
      <FormSection title="الهيكل والعمل">
        <div className="bos-form-grid">
          <SelectField name="department_id" label="القسم" placeholder="—" options={departments} value={dept} onChange={(e) => setDept(e.target.value)} />
          <SelectField name="team_id" label="الفريق" placeholder="—" options={visibleTeams} defaultValue={initial.team_id ?? ""} key={dept} />
          <SelectField name="manager_id" label="المدير المباشر" placeholder="—" options={managers} defaultValue={initial.manager_id ?? ""} />
          <TextField name="start_date" label="تاريخ البدء" type="date" defaultValue={initial.start_date ?? ""} />
          <SelectField name="employment_type" label="نوع التوظيف" options={employmentTypes} defaultValue={initial.employment_type ?? "full_time"} />
          <SelectField name="work_schedule_id" label="جدول العمل" placeholder="يرث (الفريق / القسم / الشركة)" options={schedules} defaultValue={initial.work_schedule_id ?? ""} hint="الورديات والتعيينات المؤقتة من صفحة الجداول" />
          {branches.length ? <SelectField name="branch_id" label="الفرع" options={branches} defaultValue={initial.branch_id ?? branches[0]?.value ?? ""} /> : null}
          <TextField name="work_location" label="مكان العمل / الموقع" defaultValue={initial.work_location ?? ""} />
          {categories.length ? <SelectField name="category_id" label="تصنيف الموظف" placeholder="—" options={categories} defaultValue={initial.category_id ?? ""} /> : null}
          <SelectField name="probation_status" label="فترة الاختبار" options={probationOptions} defaultValue={initial.probation_status ?? "none"} />
          <TextField name="probation_end_date" label="نهاية فترة الاختبار" type="date" defaultValue={initial.probation_end_date ?? ""} />
          <TextField name="country" label="الدولة" defaultValue={initial.country ?? ""} />
          <div className="bos-field">
            <label htmlFor="f-timezone"><Tx>المنطقة الزمنية *</Tx></label>
            <input id="f-timezone" name="timezone" list="tz-list" required dir="ltr" defaultValue={initial.timezone ?? "Africa/Cairo"} />
            <datalist id="tz-list">{commonTimezones.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
        </div>
        <CheckboxField name="is_remote" label="يعمل عن بُعد" defaultChecked={initial.is_remote ?? true} />
      </FormSection>
      <FormSection title="المهارات والمؤهلات">
        <div className="bos-form-grid">
          <TextField name="skills" label="المهارات (مفصولة بفواصل)" defaultValue={(initial.skills ?? []).join("، ")} span={2} />
          <TextField name="experience_years" label="سنوات الخبرة" inputMode="decimal" defaultValue={initial.experience_years != null ? String(initial.experience_years) : ""} />
        </div>
        <div className="bos-form-grid">
          <TextField name="qualifications" label="المؤهلات الدراسية" defaultValue={initial.qualifications ?? ""} span={2} />
          <TextField name="certifications" label="الشهادات المهنية" defaultValue={initial.certifications ?? ""} span={2} />
          <TextField name="profile_notes" label="ملاحظات" defaultValue={initial.profile_notes ?? ""} span="all" />
        </div>
      </FormSection>
      {canRoles ? (
        <FormSection title="الأدوار والصلاحيات">
          {!isNew && !hasLogin ? <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>أنشئ حساب دخول للموظف أولاً ليتم تطبيق الأدوار.</Tx></p> : null}
          <div className="bos-row" style={{ flexWrap: "wrap", gap: 10 }}>
            {roles.map((r) => (
              <label key={r.value} className="bos-check">
                <input
                  type="checkbox"
                  name="role_ids[]"
                  value={r.value}
                  checked={roleIds.includes(r.value)}
                  onChange={(e) => setRoleIds(e.target.checked ? [...roleIds, r.value] : roleIds.filter((x) => x !== r.value))}
                />
                <Tx>{r.label}</Tx>
              </label>
            ))}
          </div>
          {isNew ? <CheckboxField name="create_login" label="إنشاء حساب دخول للنظام الآن (دعوة على البريد الرسمي — لا يتم حفظ أي كلمة مرور)" defaultChecked /> : null}
        </FormSection>
      ) : null}
      {canSensitive ? (
        <FormSection title="بيانات حساسة">
          <div className="bos-form-grid">
            <MoneyField name="hourly_cost" currencyName="cost_currency" label="تكلفة الساعة" currencies={currencies} defaultValue={initial.hourly_cost ?? ""} defaultCurrency={initial.cost_currency ?? "USD"} hint="تظهر للموارد البشرية والإدارة فقط — تُستخدم لتكلفة ساعات المشاريع" />
            <SelectField name="hourly_cost_source" label="مصدر تكلفة الساعة" options={[{ value: "manual", label: "يدوي" }, { value: "salary", label: "من الراتب (الأساسي + البدلات ÷ ساعات الشهر)" }]} defaultValue={initial.hourly_cost_source ?? "manual"} />
          </div>
        </FormSection>
      ) : null}
      <div className="bos-form-actions">
        <SubmitButton label={isNew ? "إنشاء الموظف وبدء التهيئة" : "حفظ"} />
      </div>
    </ActionForm>
  );
}
