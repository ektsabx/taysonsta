import { notFound } from "next/navigation";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { NotFoundError } from "@/lib/bos/errors";
import { portalInvoice } from "@/services/bos/portal";
import { formatDate } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { PBadge, PMoney, PTop } from "../../ui";
import { PrintButton } from "./PrintButton";

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const p = await requirePortalSection("invoices");
  const { id } = await params;
  let d;
  try {
    d = await portalInvoice(p, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { invoice: i, items, payments } = d;
  return (
    <>
      <PTop title={`فاتورة ${i.invoice_number}`} actions={<PrintButton />} />
      <div className="portal-card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div><strong>{p.clientName}</strong><div className="portal-muted">الإصدار {formatDate(i.issue_date)} · الاستحقاق {formatDate(i.due_date)}</div></div>
          <PBadge map="invoice_status" value={i.status} />
        </div>
        <table className="portal-table" style={{ marginTop: 14 }}>
          <thead><tr><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
          <tbody>
            {items.map((it) => <tr key={it.id}><td>{it.description}</td><td>{Number(it.quantity)}</td><td><PMoney value={it.unit_price} currency={i.currency} /></td><td><PMoney value={it.line_total} currency={i.currency} /></td></tr>)}
          </tbody>
        </table>
        <div style={{ marginTop: 12, textAlign: "end" }}>
          <div>المجموع الفرعي: <PMoney value={i.subtotal} currency={i.currency} /></div>
          {Number(i.discount_amount) ? <div>الخصم: <PMoney value={i.discount_amount} currency={i.currency} /></div> : null}
          {Number(i.tax_amount) ? <div>الضريبة: <PMoney value={i.tax_amount} currency={i.currency} /></div> : null}
          <div style={{ fontWeight: 800, fontSize: 18 }}>الإجمالي: <PMoney value={i.total} currency={i.currency} /></div>
          <div>المدفوع: <PMoney value={i.amount_paid} currency={i.currency} /></div>
          <div style={{ fontWeight: 700 }}>المتبقي: <PMoney value={i.balance} currency={i.currency} /></div>
        </div>
        {i.notes ? <p className="portal-muted" style={{ whiteSpace: "pre-wrap" }}>{i.notes}</p> : null}
      </div>
      <div className="portal-card">
        <h2>المدفوعات</h2>
        {payments.length ? payments.map((pm) => <div key={pm.id}>{pm.payment_number} · <PMoney value={pm.amount} currency={pm.currency} /> · {formatDate(pm.payment_date)} · {statusLabel("payment_method", pm.method)}</div>) : <p className="portal-muted">لا توجد مدفوعات مسجلة.</p>}
      </div>
    </>
  );
}
