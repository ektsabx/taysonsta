import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { PurchaseTracker } from "@/components/analytics/PurchaseTracker";
import { formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { planName } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).billingResult.title} — Yolias` };
}

// Where the payment provider sends the customer back (via
// /api/payments/<provider>/return). Shows the payment's real status from the
// database — the provider's signed callback decides it, never this page.
export default async function BillingResultPage({ searchParams }: PageProps<"/billing/result">) {
  const session = await requireUser();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const r = t.billingResult;
  const { payment: id } = await searchParams;
  const supabase = await createClient();
  const { data: p } = typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase.from("payments").select("*").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle()
    : { data: null };

  const ok = p?.status === "succeeded";
  const failed = p?.status === "failed";
  const Icon = ok ? CheckCircle2 : failed || !p ? XCircle : Clock;
  const title = !p ? r.unknown : ok ? r.succeeded : failed ? r.failed : r.pending;
  const detail = !p ? null
    : ok ? (p.kind === "subscription" ? fmt(r.succeededPlan, { plan: planName(p.plan!, t) }) : fmt(r.succeededPack, { count: formatNumber(p.prospects ?? 0, locale) }))
    : failed ? r.failedHint : r.pendingHint;

  return (
    <div className="checkout-page">
      <header className="checkout-top">
        <Link href="/" aria-label="Yolias"><BrandLogo /></Link>
      </header>
      <main className="billing-result">
        {ok && p && (
          <PurchaseTracker
            paymentId={p.id} value={Number(p.amount)} currency={p.currency} kind={p.kind} live={p.mode === "live"}
            item={p.kind === "subscription" ? `${p.plan}_${p.billing_period}` : `prospects_${p.prospects}`}
          />
        )}
        <Icon className={`billing-result-icon${ok ? " ok" : failed || !p ? " bad" : ""}`} />
        <h1>{title}</h1>
        {p && <p className="billing-result-amount" dir="ltr">{formatMoney(Number(p.amount), p.currency, true)}</p>}
        {detail && <p className="billing-result-detail">{detail}</p>}
        <div className="billing-result-actions">
          {ok && p?.invoice_id && <Link className="btn-secondary" href={`/invoices/${p.invoice_id}`}>{r.viewInvoice}</Link>}
          {failed && <Link className="btn-secondary" href={p?.kind === "subscription" ? `/checkout?plan=${p.plan}&period=${p.billing_period}` : "/"}>{r.tryAgain}</Link>}
          <Link className="btn-primary" href="/">{r.continue}</Link>
        </div>
      </main>
    </div>
  );
}
