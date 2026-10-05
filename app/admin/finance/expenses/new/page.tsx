import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listActiveStaff, listCurrencies } from "@/services/bos/shared";
import { todayIn } from "@/lib/bos/format";
import { PageHeader } from "@/components/bos/ui";
import { ExpenseForm } from "./ExpenseForm";

export default async function NewExpensePage() {
  const { bos } = await requirePermission("expenses.create");
  const [currencies, staff, { data: categories }] = await Promise.all([listCurrencies(), listActiveStaff(), db().from("expense_categories").select("id, name").eq("is_active", true).order("name")]);
  return (
    <>
      <PageHeader title="مصروف جديد" />
      <ExpenseForm
        currencies={currencies}
        today={todayIn(bos.employee.timezone)}
        categories={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
      />
    </>
  );
}
