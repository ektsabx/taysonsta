"use client";

import { ActionForm, FormSection, SubmitButton, TextField } from "@/components/bos/Form";
import { adjustUsageAction, setPlanQuotaAction } from "./usage-actions";

export function PlanQuotaForm({ plan, prospects, priceUsd, priceEgp }: { plan: string; prospects: number; priceUsd: number; priceEgp: number | null }) {
  return (
    <ActionForm action={setPlanQuotaAction} successMessage="تم الحفظ">
      <input type="hidden" name="plan" value={plan} />
      <FormSection>
        <TextField name="prospects" label="العملاء المحتملون شهرياً" type="number" min={0} step={1} required defaultValue={String(prospects)} />
        <TextField name="price_usd" label="السعر الشهري (USD)" type="number" min={0} step={0.01} required defaultValue={String(priceUsd)} readOnly={plan === "free"} />
        <TextField name="price_egp" label="السعر الشهري (EGP)" type="number" min={0} step={0.01} defaultValue={priceEgp == null ? "" : String(priceEgp)} readOnly={plan === "free"} hint="لعملاء مصر. فارغ = تظهر لهم الأسعار بالدولار." />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function AdjustUsageForm({ workspaceId }: { workspaceId: string }) {
  return (
    <ActionForm action={adjustUsageAction} successMessage="تم الحفظ" resetOnSuccess>
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <FormSection>
        <TextField name="prospects" label="عدد العملاء المحتملين" type="number" step={1} required hint="موجب = منحة إضافية لهذا الشهر، سالب = خصم." />
        <TextField name="reason" label="السبب" required span={2} />
      </FormSection>
      <SubmitButton label="تطبيق" />
    </ActionForm>
  );
}
