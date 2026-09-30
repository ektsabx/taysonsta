import { requirePermission, can } from "@/lib/bos/auth";
import { listActiveStaff, listCurrencies } from "@/services/bos/shared";
import { defaultCurrencyFor } from "@/lib/bos/branch";
import { PageHeader } from "@/components/bos/ui";
import { ProjectForm } from "../ProjectForm";
import { createProjectAction } from "../actions";

export default async function NewProjectPage() {
  const { bos } = await requirePermission("projects.create");
  const [currencies, staff, currency] = await Promise.all([listCurrencies(), listActiveStaff(), defaultCurrencyFor(bos)]);
  return (
    <>
      <PageHeader title="مشروع داخلي جديد" subtitle="مشاريع العملاء تُنشأ تلقائياً عند كسب الصفقة — استخدم هذا للمشاريع الداخلية أو الاستثنائية." />
      <ProjectForm action={createProjectAction} currencies={currencies} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} canEditBudget canAssign={can(bos, "projects.assign")} initial={{ pm_id: bos.userId, currency }} submitLabel="إنشاء المشروع" />
    </>
  );
}
