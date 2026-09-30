import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listActiveStaff, listCurrencies } from "@/services/bos/shared";
import { todayIn } from "@/lib/bos/format";
import { PageHeader } from "@/components/bos/ui";
import { ExpenseForm } from "./ExpenseForm";

export default async function NewExpensePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("expenses.create");
  const sp = await readParams(searchParams);
  const [currencies, staff, { data: categories }] = await Promise.all([listCurrencies(), listActiveStaff(), db().from("expense_categories").select("id, name").eq("is_active", true).order("name")]);
  let initialProject = null;
  if (sp.projectId) {
    const { data } = await db().from("projects").select("id, name, project_number").eq("id", sp.projectId).maybeSingle();
    if (data) initialProject = { id: data.id, label: data.name, sub: data.project_number };
  }
  return (
    <>
      <PageHeader title="مصروف جديد" breadcrumbs={[{ label: "المصروفات", href: "/admin/finance/expenses" }, { label: "جديد" }]} />
      <ExpenseForm
        currencies={currencies}
        today={todayIn(bos.employee.timezone)}
        categories={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        initialProject={initialProject}
      />
    </>
  );
}
