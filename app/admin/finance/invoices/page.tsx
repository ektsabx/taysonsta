import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listInvoices, invoiceTotalsByCurrency } from "@/services/bos/finance-queries";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Money, KpiCard } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate, todayIn } from "@/lib/bos/format";
import { formatMoney } from "@/lib/bos/money";
import { statusOptions } from "@/lib/bos/labels";

const columns: DataColumn[] = [
  { key: "number", label: "الفاتورة", primary: true, alwaysVisible: true },
  { key: "client", label: "الحساب" },
  { key: "issue", label: "الإصدار" },
  { key: "due", label: "الاستحقاق" },
  { key: "total", label: "الإجمالي", align: "end" },
  { key: "paid", label: "المدفوع", align: "end" },
  { key: "balance", label: "المتبقي", align: "end" },
  { key: "status", label: "الحالة" },
];

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("invoices.read");
  const params = await readParams(searchParams);
  const [result, totals, currencies] = await Promise.all([listInvoices(bos, scope, { ...params, page: pageOf(params) }), invoiceTotalsByCurrency(bos, scope), listCurrencies()]);
  const today = todayIn(bos.employee.timezone);

  return (
    <>
      <PageHeader
        title="الفواتير"
       
        actions={
          <>
            {can(bos, "payments.create") ? <Link href="/admin/finance/payments/new" className="admin-btn small secondary"><Tx>تسجيل دفعة</Tx></Link> : null}
            {can(bos, "invoices.create") ? <Link href="/admin/finance/invoices/new" className="admin-btn small"><Tx>+ فاتورة</Tx></Link> : null}
          </>
        }
      />
      {totals.length ? (
        <div className="bos-kpis">
          {totals.map((t) => (
            <KpiCard key={t.currency} label={`${t.currency} — المستحق`} value={formatMoney(t.outstanding, t.currency)} sub={`مفوتر ${formatMoney(t.invoiced, t.currency)} · متأخر ${formatMoney(t.overdue, t.currency)}`} />
          ))}
        </div>
      ) : null}
      <FilterBar
        searchPlaceholder="رقم الفاتورة..."
        filters={[
          { key: "status", label: "الحالة", type: "select", options: [{ value: "open", label: "مفتوحة (غير مسددة)" }, ...statusOptions("invoice_status")] },
          { key: "currency", label: "العملة", type: "select", options: currencies.map((c) => ({ value: c, label: c })) },
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
        ]}
      />
      <DataTable
        tableId="invoices"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "invoices.export") ? "/api/bos/export/invoices" : undefined}
        empty={<EmptyState title="لا توجد فواتير" description="تُنشأ الفواتير تلقائياً من جدول الدفعات عند كسب الصفقة، أو يدوياً." actions={can(bos, "invoices.create") ? <Link href="/admin/finance/invoices/new" className="admin-btn small"><Tx>فاتورة جديدة</Tx></Link> : null} />}
        rows={result.rows.map((i) => {
          const client = i.clients as unknown as { name: string; company_name: string | null } | null;
          const overdue = ["sent", "partially_paid"].includes(i.status) && i.due_date < today;
          return {
            id: i.id,
            cells: {
              number: <Link href={`/admin/finance/invoices/${i.id}`}>{i.invoice_number}</Link>,
              client: client ? <Link href={`/admin/clients/${i.client_id}`}>{client.company_name ?? client.name}</Link> : "—",
              issue: formatDate(i.issue_date),
              due: <span style={overdue || i.status === "overdue" ? { color: "var(--bos-danger)" } : undefined}>{formatDate(i.due_date)}</span>,
              total: <Money value={i.total} currency={i.currency} />,
              paid: <Money value={Number(i.amount_paid) - Number(i.amount_refunded)} currency={i.currency} />,
              balance: <Money value={i.balance} currency={i.currency} />,
              status: <StatusBadge map="invoice_status" value={i.status} />,
            },
          };
        })}
      />
    </>
  );
}
