import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalPayments } from "@/services/bos/portal";
import { formatDate } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { PBadge, PEmpty, PMoney, PTop } from "../ui";

export default async function PortalPaymentsPage() {
  const p = await requirePortalSection("payments");
  const rows = await portalPayments(p);
  return (
    <>
      <PTop title="المدفوعات" />
      <div className="portal-card">
        {rows.length ? (
          <table className="portal-table">
            <thead><tr><th>الدفعة</th><th>الفاتورة</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((pm) => (
                <tr key={pm.id}>
                  <td>{pm.payment_number}</td>
                  <td>{pm.invoice_id ? <Link href={`/portal/invoices/${pm.invoice_id}`}>{(pm.invoices as unknown as { invoice_number: string } | null)?.invoice_number ?? "—"}</Link> : "—"}</td>
                  <td><PMoney value={pm.amount} currency={pm.currency} />{Number(pm.refunded_amount) ? <div className="portal-muted">مسترد: <PMoney value={pm.refunded_amount} currency={pm.currency} /></div> : null}</td>
                  <td>{statusLabel("payment_method", pm.method)}</td>
                  <td>{formatDate(pm.payment_date)}</td>
                  <td><PBadge map="payment_status" value={pm.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <PEmpty title="لا توجد مدفوعات" />}
      </div>
    </>
  );
}
