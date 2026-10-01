import { ImportButton } from "@/components/bos/ImportButton";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listAccounts } from "@/services/bos/accounts";
import { canSeeSensitive, listActiveStaff, listSavedViews, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Money } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { deleteViewAction, saveViewAction } from "@/app/admin/_actions/common";
import { bulkAssignAccountsAction } from "./actions";
import { accountStatusOptions } from "./AccountForm";

export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("clients.read");
  const params = await readParams(searchParams);
  const [result, staff, names, views] = await Promise.all([
    listAccounts(bos, scope, { ...params, page: pageOf(params) }),
    listActiveStaff(),
    userNameMap(),
    listSavedViews(bos, "clients"),
  ]);
  const showMoney = canSeeSensitive(bos, "revenue");
  const showOutstanding = can(bos, "invoices.read");

  const columns: DataColumn[] = [
    { key: "name", label: "الحساب", sortable: true, primary: true, alwaysVisible: true },
    { key: "industry", label: "المجال", sortable: true },
    { key: "country", label: "الدولة", sortable: true },
    { key: "manager", label: "مدير الحساب" },
    { key: "status", label: "الحالة" },
    { key: "projects", label: "مشاريع نشطة" },
    ...(showMoney ? [{ key: "revenue", label: "إجمالي الإيراد", align: "end" as const }] : []),
    ...(showOutstanding ? [{ key: "outstanding", label: "المستحق", align: "end" as const }] : []),
    { key: "last", label: "آخر نشاط" },
    { key: "created_at", label: "تاريخ الإنشاء", sortable: true, defaultHidden: true },
  ];
  const multi = (items: { currency: string; amount: string }[]) => (items.length ? items.map((m) => <div key={m.currency}><Money value={m.amount} currency={m.currency} /></div>) : "—");

  return (
    <>
      <PageHeader
        title="الحسابات"
        subtitle={<Tx vars={{ total: result.total }}>{"{total} حساب"}</Tx>}
       
        actions={<span className="bos-row" style={{ gap: 6 }}><ImportButton bos={bos} type="clients" />{can(bos, "clients.create") ? <Link href="/admin/clients/new" className="admin-btn small"><Tx>+ حساب جديد</Tx></Link> : null}</span>}
      />
      <FilterBar
        searchPlaceholder="بحث بالاسم أو الشركة أو البريد أو الهاتف..."
        filters={[
          { key: "status", label: "الحالة", type: "select", options: accountStatusOptions },
          ...(scope !== "own" && scope !== "assigned"
            ? [{ key: "manager", label: "مدير الحساب", type: "select" as const, options: [{ value: "me", label: "أنا" }, { value: "none", label: "بدون" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))] }]
            : []),
          { key: "country", label: "الدولة", type: "text" },
          { key: "industry", label: "المجال", type: "text" },
          { key: "archived", label: "المؤرشفة", type: "select", options: [{ value: "1", label: "عرض المؤرشفة" }] },
        ]}
      />
      <DataTable
        tableId="clients"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "clients.export") ? "/api/bos/export/clients" : undefined}
        savedViews={views}
        onSaveView={saveViewAction.bind(null, "clients")}
        onDeleteView={deleteViewAction}
        bulkActions={
          can(bos, "clients.assign")
            ? [{ key: "assign", label: "تعيين مدير حساب", action: bulkAssignAccountsAction, optionLabel: "مدير الحساب", options: [{ value: "none", label: "— بدون —" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))] }]
            : undefined
        }
        empty={<EmptyState title="لا توجد حسابات" description="الحسابات تُنشأ تلقائياً عند تحويل عميل محتمل لصفقة، أو يدوياً." />}
        rows={result.rows.map((c) => ({
          id: c.id,
          cells: {
            name: (
              <Link href={`/admin/clients/${c.id}`}>
                {c.company_name ?? c.name}
                <span className="cell-sub">{c.company_name ? `${c.name} · ` : ""}{c.email}</span>
              </Link>
            ),
            industry: c.industry ?? "—",
            country: [c.country, c.city].filter(Boolean).join(" · ") || "—",
            manager: c.account_manager_id ? names.get(c.account_manager_id) ?? "—" : <span className="bos-faint"><Tx>غير معيّن</Tx></span>,
            status: c.archived_at ? <StatusBadge tone="neutral" label="مؤرشف" /> : <StatusBadge map="account_status" value={c.account_status} />,
            projects: c.activeProjects || "—",
            revenue: multi(c.revenue),
            outstanding: multi(c.outstanding),
            last: formatDate(c.lastActivityAt),
            created_at: formatDate(c.created_at),
          },
        }))}
      />
    </>
  );
}
