import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { planName } from "@/lib/plans";
import { requireSession } from "@/lib/session";
import { getInvoice } from "@/services/workspace";
import { PrintButton } from "./PrintButton";

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getDictionary();
  const inv = /^[0-9a-f-]{36}$/i.test(id) ? await getInvoice(id) : null;
  return { title: inv ? `${t.invoice.title} ${inv.number} — Yolias` : "Yolias" };
}

const money = (n: number) => `$${n.toFixed(2)}`;

// Printable invoice (Claude/Stripe style). Visible to the workspace owner and
// admins only (RLS on invoices). "Download PDF" uses the browser's print.
export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const v = t.invoice;
  const amount = Number(inv.amount_usd);
  const date = (iso: string) => formatDate(iso, locale);
  const name = planName(inv.plan, t);
  const period = inv.billing_period === "annual" ? t.plans.billedAnnually : t.plans.billedMonthly;

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar">
        <Link href="/" className="invoice-back"><ArrowLeft className="flip-rtl" /> {v.back}</Link>
        <PrintButton label={v.download} />
      </div>

      <article className="invoice-sheet">
        {inv.mode === "test" && <div className="invoice-test">{v.testMode}</div>}
        <header className="invoice-head">
          <h1>{v.title}</h1>
          <BrandLogo size={24} />
        </header>

        <dl className="invoice-meta">
          <dt>{v.number}</dt><dd dir="ltr">{inv.number}</dd>
          <dt>{v.issued}</dt><dd>{date(inv.created_at)}</dd>
          <dt>{v.due}</dt><dd>{date(inv.created_at)}</dd>
        </dl>

        <div className="invoice-parties">
          <div>
            <strong>Yolias</strong>
            <span>{v.seller}</span>
            <span dir="ltr">yolias.ai</span>
          </div>
          <div>
            <span className="invoice-label">{v.billTo}</span>
            {inv.bill_to_name && <strong>{inv.bill_to_name}</strong>}
            {inv.bill_to_company && <span>{inv.bill_to_company}</span>}
            <span dir="ltr">{inv.bill_to_email}</span>
          </div>
        </div>

        <p className="invoice-amount">
          {inv.status === "paid"
            ? fmt(v.paidOn, { amount: money(amount), date: date(inv.created_at) })
            : fmt(v.dueOn, { amount: money(amount), date: date(inv.created_at) })}
        </p>

        <table className="invoice-lines">
          <thead>
            <tr><th>{v.description}</th><th>{v.qty}</th><th>{v.unitPrice}</th><th>{v.amount}</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {name}
                <small>{fmt(v.periodRange, { start: date(inv.period_start), end: date(inv.period_end) })} · {period}</small>
              </td>
              <td>1</td>
              <td dir="ltr">{money(amount)}</td>
              <td dir="ltr">{money(amount)}</td>
            </tr>
          </tbody>
        </table>

        <dl className="invoice-totals">
          <dt>{v.subtotal}</dt><dd dir="ltr">{money(amount)}</dd>
          <dt>{v.tax}</dt><dd dir="ltr">{money(0)}</dd>
          <dt className="strong">{v.total}</dt><dd className="strong" dir="ltr">{money(amount)}</dd>
          {inv.status === "paid" && <><dt className="strong">{v.amountPaid}</dt><dd className="strong" dir="ltr">{money(amount)}</dd></>}
        </dl>

        <footer className="invoice-foot">
          {v.footer} <span dir="ltr">yolias.ai/contact</span>
        </footer>
      </article>
    </div>
  );
}
