"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/bos/action";
import { ActionForm, CheckboxField, Field, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";

export function TaskForm({
  action,
  staff,
  milestonesByProject,
  initial = {},
  initialProject = null,
  initialDeal = null,
  hidden = {},
  canAssign,
  submitLabel = "حفظ",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  staff: { value: string; label: string }[];
  milestonesByProject: Record<string, { value: string; label: string }[]>;
  initial?: { title?: string; description?: string | null; assigned_to?: string | null; milestone_id?: string | null; priority?: string; due_date?: string | null; start_date?: string | null; estimated_hours?: string; is_required?: boolean; client_visible?: boolean };
  initialProject?: EntityOption | null;
  initialDeal?: EntityOption | null;
  hidden?: Record<string, string | null | undefined>;
  canAssign: boolean;
  submitLabel?: string;
}) {
  const [project, setProject] = useState<EntityOption | null>(initialProject);
  const milestones = project ? milestonesByProject[project.id] ?? [] : [];
  return (
    <ActionForm action={action} successMessage="تم الحفظ">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <FormSection title="المهمة">
        <TextField name="title" label="عنوان المهمة" required defaultValue={initial.title ?? ""} span="all" />
        <Field label="المشروع" name="project_id">
          <EntitySelector name="project_id" initial={initialProject} onChange={setProject} search={(q) => searchEntitiesAction("project", q)} placeholder="اختياري" />
        </Field>
        {project ? (
          <SelectField name="milestone_id" label="المرحلة" options={milestones} placeholder="بدون مرحلة" defaultValue={initial.milestone_id ?? ""} key={project.id} />
        ) : (
          <Field label="الصفقة" name="deal_id">
            <EntitySelector name="deal_id" initial={initialDeal} search={(q) => searchEntitiesAction("deal", q)} placeholder="اختياري" />
          </Field>
        )}
        {canAssign ? <SelectField name="assigned_to" label="المسؤول" options={staff} placeholder="غير معيّن" defaultValue={initial.assigned_to ?? ""} /> : <input type="hidden" name="assigned_to" value={initial.assigned_to ?? ""} />}
        <SelectField name="priority" label="الأولوية" options={[{ value: "low", label: "منخفضة" }, { value: "medium", label: "متوسطة" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }]} defaultValue={initial.priority ?? "medium"} />
        <TextField name="start_date" label="تاريخ البدء" type="date" defaultValue={initial.start_date ?? ""} />
        <TextField name="due_date" label="تاريخ الاستحقاق" type="date" defaultValue={initial.due_date ?? ""} />
        <TextField name="estimated_hours" label="الوقت المقدر (ساعات)" inputMode="decimal" defaultValue={initial.estimated_hours ?? ""} />
        <CheckboxField name="is_required" label="مطلوبة لإكمال المشروع" defaultChecked={initial.is_required ?? true} />
        <CheckboxField name="client_visible" label="تظهر للعميل في بوابة العملاء" defaultChecked={initial.client_visible ?? false} />
        <TextAreaField name="description" label="الوصف" defaultValue={initial.description ?? ""} />
      </FormSection>
      <div className="bos-form-actions">
        <SubmitButton label={submitLabel} />
      </div>
    </ActionForm>
  );
}
