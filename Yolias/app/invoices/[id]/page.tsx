import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { planName } from "@/lib/plans";
import { canManageTeam, requireUser } from "@/lib/session";
import { providerFor } from "@/lib/payments";
import { RENEWAL_GRACE_DAYS } from "@/lib/billing";
import { getInvoice } from "@/services/workspace";
import { PrintButton } from "./PrintButton";
import { PayButton } from "./PayButton";

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getDictionary();
  const inv = /^[0-9a-f-]{36}$/i.test(id) ? await getInvoice(id) : null;
  return { title: inv ? `${t.invoice.title} ${inv.number} — Yolias` : "Yolias" };
}

// Printable invoice (Claude/Stripe style). Visible to the workspace owner and
// admins only (RLS on invoices). "Download PDF" uses the browser's print.
export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  // requireUser, not requireSession: a past-due workspace must still reach its invoice to pay it.
  const session = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const v = t.invoice;
  const amount = Number(inv.amount);
  const money = (n: number) => formatMoney(n, inv.currency, true);
  const date = (iso: string) => formatDate(iso, locale, session.profile.timezone);
  const name = inv.plan ? planName(inv.plan, t) : fmt(t.buyMore.packName, { count: formatNumber(inv.prospects ?? 0, locale) });
  const period = inv.kind === "prospect_pack" ? t.invoicePay.pack : inv.billing_period === "annual" ? t.plans.billedAnnually : t.plans.billedMonthly;
  const dueAt = new Date(new Date(inv.period_start).getTime() + RENEWAL_GRACE_DAYS * 86_400_000).toISOString();
  const canPay = inv.status === "open" && canManageTeam(session) && Boolean(await providerFor(inv.currency));

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar">
        <Link href="/" className="invoice-back"><ArrowLeft className="flip-rtl" /> {v.back}</Link>
        <span className="invoice-actions">
          {canPay && <PayButton invoiceId={inv.id} label={t.invoicePay.pay} pendingLabel={t.invoicePay.paying} />}
          <PrintButton label={v.download} />
        </span>
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
          <dt>{v.due}</dt><dd>{date(inv.status === "open" ? dueAt : inv.created_at)}</dd>
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
            : inv.status === "void" ? `${t.invoicePay.void} · ${money(amount)}`
            : fmt(v.dueOn, { amount: money(amount), date: date(dueAt) })}
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
