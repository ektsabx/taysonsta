import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalInvoices } from "@/services/bos/portal";
import { formatDate } from "@/lib/bos/format";
import { PBadge, PEmpty, PMoney, PTop } from "../ui";

export default async function PortalInvoicesPage() {
  const p = await requirePortalSection("invoices");
  const rows = await portalInvoices(p);
  return (
    <>
      <PTop title="الفواتير" />
      <div className="portal-card">
        {rows.length ? (
          <table className="portal-table">
            <thead><tr><th>الفاتورة</th><th>الإصدار</th><th>الاستحقاق</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/portal/invoices/${i.id}`}>{i.invoice_number}</Link></td>
                  <td>{formatDate(i.issue_date)}</td>
                  <td>{formatDate(i.due_date)}</td>
                  <td><PMoney value={i.total} currency={i.currency} /></td>
                  <td><PMoney value={i.amount_paid} currency={i.currency} /></td>
                  <td><PMoney value={i.balance} currency={i.currency} /></td>
                  <td><PBadge map="invoice_status" value={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <PEmpty title="لا توجد فواتير" />}
      </div>
    </>
  );
}
