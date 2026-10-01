import { ImportButton } from "@/components/bos/ImportButton";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requireBosUser, can } from "@/lib/bos/auth";
import { redirect } from "next/navigation";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listExpenses } from "@/services/bos/finance-queries";
import { PageHeader, StatusBadge, EmptyState, Money } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import type { Scope } from "@/lib/bos/permissions";

const columns: DataColumn[] = [
  { key: "desc", label: "المصروف", primary: true, alwaysVisible: true },
  { key: "category", label: "الفئة" },
  { key: "vendor", label: "المورد" },
  { key: "project", label: "المشروع" },
  { key: "date", label: "التاريخ" },
  { key: "amount", label: "المبلغ", align: "end" },
  { key: "status", label: "الموافقة" },
];

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const bos = await requireBosUser();
  const scope = (bos.permissions.get("expenses.read") ?? (bos.permissions.has("expenses.create") ? "own" : undefined)) as Scope | undefined;
  if (!scope) redirect("/admin/forbidden");
  const params = await readParams(searchParams);
  const [result, { data: categories }] = await Promise.all([listExpenses(bos, scope, { ...params, page: pageOf(params) }), db().from("expense_categories").select("id, name").eq("is_active", true).order("name")]);
  return (
    <>
      <PageHeader title="المصروفات" actions={<span className="bos-row" style={{ gap: 6 }}><ImportButton bos={bos} type="expenses" />{can(bos, "expenses.create") ? <Link href="/admin/finance/expenses/new" className="admin-btn small"><Tx>+ مصروف</Tx></Link> : null}</span>} />
      <FilterBar
        searchPlaceholder="بحث في الوصف..."
        filters={[
          { key: "status", label: "الموافقة", type: "select", options: statusOptions("simple_approval").filter((o) => o.value !== "cancelled") },
          { key: "category", label: "الفئة", type: "select", options: (categories ?? []).map((c) => ({ value: c.id, label: c.name })) },
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
        ]}
      />
      <DataTable
        tableId="expenses"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "expenses.export") ? "/api/bos/export/expenses" : undefined}
        empty={<EmptyState title="لا توجد مصروفات" description="سجّل تكاليف الاستضافة والأدوات والمستقلين وربطها بالمشاريع لحساب الربحية." actions={can(bos, "expenses.create") ? <Link href="/admin/finance/expenses/new" className="admin-btn small"><Tx>مصروف جديد</Tx></Link> : null} />}
        rows={result.rows.map((e) => ({
          id: e.id,
          cells: {
            desc: <Link href={`/admin/finance/expenses/${e.id}`}><Tx>{e.description}</Tx></Link>,
            category: (e.expense_categories as unknown as { name: string } | null)?.name ?? "—",
            vendor: (e.vendors as unknown as { name: string } | null)?.name ?? "—",
            project: e.project_id ? <Link href={`/admin/projects/${e.project_id}?tab=finance`}>{(e.projects as unknown as { name: string } | null)?.name}</Link> : "—",
            date: formatDate(e.expense_date),
            amount: <Money value={e.amount} currency={e.currency} />,
            status: <StatusBadge map="simple_approval" value={e.approval_status} />,
          },
        }))}
      />
    </>
  );
}
