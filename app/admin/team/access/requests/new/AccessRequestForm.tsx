"use client";

import { useState } from "react";
import { ActionForm, SelectField, SubmitButton, TextAreaField } from "@/components/bos/Form";
import { requestAccessAction } from "@/app/admin/team/actions";

export function AccessRequestForm({ employees, defaultEmployee, apps }: { employees: { value: string; label: string }[]; defaultEmployee: string; apps: { id: string; name: string; access_levels: string[]; is_sensitive: boolean }[] }) {
  const [app, setApp] = useState("");
  const selected = apps.find((a) => a.id === app);
  return (
    <ActionForm action={requestAccessAction} redirectTo="/admin/team/access?view=requests">
      <div className="bos-form-grid">
        {employees.length > 1 ? <SelectField name="employee_id" label="الموظف" required options={employees} defaultValue={defaultEmployee} /> : <input type="hidden" name="employee_id" value={defaultEmployee} />}
        <SelectField name="app_id" label="التطبيق" required placeholder="اختر..." options={apps.map((a) => ({ value: a.id, label: `${a.name}${a.is_sensitive ? " (حساس)" : ""}` }))} value={app} onChange={(e) => setApp(e.target.value)} />
        {selected?.access_levels.length ? <SelectField name="access_level" label="مستوى الصلاحية" placeholder="—" options={selected.access_levels.map((l) => ({ value: l, label: l }))} /> : null}
      </div>
      <TextAreaField name="reason" label="السبب" required rows={4} />
      <p className="bos-faint" style={{ fontSize: 12 }}>المسار: {selected?.is_sensitive ? "موافقة المدير ← موافقة الأمان/المدير العام" : "موافقة المدير ← موافقة الإدارة/IT"} ← منح الوصول ← سجل التدقيق.</p>
      <div className="bos-form-actions"><SubmitButton label="إرسال الطلب" /></div>
    </ActionForm>
  );
}
