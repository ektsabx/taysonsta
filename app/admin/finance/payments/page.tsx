import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listPayments } from "@/services/bos/finance-queries";
import { PageHeader, StatusBadge, EmptyState, Money } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusLabel, statusOptions } from "@/lib/bos/labels";

const columns: DataColumn[] = [
  { key: "number", label: "الدفعة", primary: true, alwaysVisible: true },
  { key: "client", label: "الحساب" },
  { key: "invoice", label: "الفاتورة" },
  { key: "date", label: "التاريخ" },
  { key: "method", label: "الطريقة" },
  { key: "amount", label: "المبلغ", align: "end" },
  { key: "refunded", label: "المسترد", align: "end", defaultHidden: true },
  { key: "status", label: "الحالة" },
];

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("payments.read");
  const params = await readParams(searchParams);
  const result = await listPayments(bos, scope, { ...params, page: pageOf(params) });
  return (
    <>
      <PageHeader title="المدفوعات" actions={can(bos, "payments.create") ? <Link href="/admin/finance/payments/new" className="admin-btn small"><Tx>+ تسجيل دفعة</Tx></Link> : null} />
      <FilterBar
        searchPlaceholder="رقم الدفعة أو المرجع..."
        filters={[
          { key: "status", label: "الحالة", type: "select", options: statusOptions("payment_status") },
          { key: "method", label: "الطريقة", type: "select", options: statusOptions("payment_method") },
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
        ]}
      />
      <DataTable
        tableId="payments"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "payments.export") ? "/api/bos/export/payments" : undefined}
        empty={<EmptyState title="لا توجد مدفوعات" actions={can(bos, "payments.create") ? <Link href="/admin/finance/payments/new" className="admin-btn small"><Tx>تسجيل دفعة</Tx></Link> : null} />}
        rows={result.rows.map((p) => {
          const client = p.clients as unknown as { name: string; company_name: string | null } | null;
          const inv = p.invoices as unknown as { invoice_number: string } | null;
          return {
            id: p.id,
            cells: {
              number: <Link href={`/admin/finance/payments/${p.id}`}>{p.payment_number}{p.reference ? <span className="cell-sub"><Tx>{p.reference}</Tx></span> : null}</Link>,
              client: client ? <Link href={`/admin/clients/${p.client_id}`}>{client.company_name ?? client.name}</Link> : "—",
              invoice: inv ? <Link href={`/admin/finance/invoices/${p.invoice_id}`}>{inv.invoice_number}</Link> : "—",
              date: formatDate(p.payment_date),
              method: statusLabel("payment_method", p.method),
              amount: <Money value={p.amount} currency={p.currency} />,
              refunded: Number(p.refunded_amount) > 0 ? <Money value={p.refunded_amount} currency={p.currency} /> : "—",
              status: <StatusBadge map="payment_status" value={p.status} />,
            },
          };
        })}
      />
    </>
  );
}
