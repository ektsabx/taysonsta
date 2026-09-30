import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { formatMoney } from "@/lib/bos/money";
import { formatDate } from "@/lib/bos/format";
import { PrintButton } from "./PrintButton";

// Printable invoice (browser "Save as PDF"). Light, print-friendly layout.
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("invoices.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "invoice", id))) notFound();
  const [{ data: inv }, { data: items }, company] = await Promise.all([
    db().from("invoices").select("*, clients(name, company_name, email, address, tax_id, country)").eq("id", id).maybeSingle(),
    db().from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
    getSetting("company"),
  ]);
  if (!inv) notFound();
  const client = inv.clients as unknown as { name: string; company_name: string | null; email: string; address: string | null; tax_id: string | null; country: string | null };
  const money = (v: unknown) => formatMoney(v, inv.currency);

  return (
    <div className="invoice-print" dir="ltr">
      <style>{`
        .admin-sidebar, .admin-topheader { display: none !important; }
        .admin-main { max-width: none !important; padding: 0 !important; }
        .admin-shell { background: #fff !important; }
        .invoice-print { background: #fff; color: #111; max-width: 820px; margin: 24px auto; padding: 40px; font-family: Inter, "IBM Plex Sans Arabic", sans-serif; font-size: 13px; }
        .invoice-print h1 { font-size: 26px; margin: 0; }
        .invoice-print table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        .invoice-print th, .invoice-print td { border-bottom: 1px solid #e5e5e5; padding: 8px 6px; text-align: left; }
        .invoice-print th { font-size: 11px; text-transform: uppercase; color: #666; }
        .invoice-print .num { text-align: right; font-variant-numeric: tabular-nums; }
        .invoice-print .row { display: flex; justify-content: space-between; gap: 24px; }
        .invoice-print .muted { color: #666; }
        .invoice-print .totals { margin-top: 16px; margin-left: auto; width: 280px; }
        .invoice-print .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
        .invoice-print .grand { font-weight: 800; font-size: 16px; border-top: 2px solid #111; margin-top: 6px; padding-top: 8px !important; }
        @media print { .no-print { display: none !important; } .invoice-print { margin: 0; padding: 0; } }
      `}</style>
      <div className="row no-print" style={{ marginBottom: 20 }}>
        <PrintButton />
      </div>
      <div className="row">
        <div>
          <h1>INVOICE</h1>
          <div className="muted">{inv.invoice_number}</div>
          <div style={{ marginTop: 6 }}>Status: {inv.status.replace("_", " ")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>{company.name}</strong>
          <div className="muted">{company.address}</div>
          <div className="muted">{company.contact_email}</div>
          {company.tax_id ? <div className="muted">Tax ID: {company.tax_id}</div> : null}
        </div>
      </div>
      <div className="row" style={{ marginTop: 28 }}>
        <div>
          <div className="muted">Bill to</div>
          <strong>{client.company_name ?? client.name}</strong>
          <div>{client.name}</div>
          <div className="muted">{client.email}</div>
          {client.address ? <div className="muted">{client.address}</div> : null}
          {client.tax_id ? <div className="muted">Tax ID: {client.tax_id}</div> : null}
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Issue date: {formatDate(inv.issue_date)}</div>
          <div>Due date: {formatDate(inv.due_date)}</div>
          <div>Currency: {inv.currency}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((it) => (
            <tr key={it.id}>
              <td>{it.description}</td>
              <td className="num">{it.quantity}</td>
              <td className="num">{money(it.unit_price)}</td>
              <td className="num">{money(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="totals">
        <div><span>Subtotal</span><span>{money(inv.subtotal)}</span></div>
        {Number(inv.discount_amount) > 0 ? <div><span>Discount</span><span>-{money(inv.discount_amount)}</span></div> : null}
        {Number(inv.tax_rate) > 0 ? <div><span>Tax ({inv.tax_rate}%)</span><span>{money(inv.tax_amount)}</span></div> : null}
        <div className="grand"><span>Total</span><span>{money(inv.total)}</span></div>
        <div><span>Paid</span><span>{money(Number(inv.amount_paid) - Number(inv.amount_refunded))}</span></div>
        <div style={{ fontWeight: 700 }}><span>Balance due</span><span>{money(inv.balance)}</span></div>
      </div>
      {inv.payment_terms ? <p style={{ marginTop: 28, whiteSpace: "pre-wrap" }}><strong>Payment terms</strong><br />{inv.payment_terms}</p> : null}
      {inv.notes ? <p style={{ whiteSpace: "pre-wrap" }} className="muted">{inv.notes}</p> : null}
    </div>
  );
}
