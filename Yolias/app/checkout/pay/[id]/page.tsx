import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { KashierFrame } from "@/components/app/KashierFrame";
import { formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isKashierUrl } from "@/lib/payments/kashier";
import { noindex } from "@/lib/seo";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).checkout.securePayment} | Yolias`, robots: noindex };
}

// Pays a pending Kashier payment inside Yolias (D-235): prospect packs,
// renewal invoices, or a checkout opened without JavaScript.
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const { data: p } = await (await createClient()).from("payments").select("*").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!p) notFound();
  if (p.status !== "pending" || !p.checkout_url || !isKashierUrl(p.checkout_url)) redirect(`/billing/result?payment=${p.id}`);
  const what = p.kind === "prospect_pack" ? fmt(t.buyMore.packName, { count: formatNumber(p.prospects ?? 0, locale) }) : `${t.plans[p.plan ?? "pro"]} · ${p.billing_period === "annual" ? t.plans.billedAnnually : t.plans.billedMonthly}`;
  return (
    <div className="checkout-page">
      <header className="checkout-top">
        <Link href="/" aria-label="Yolias"><BrandLogo /></Link>
        <div className="checkout-top-actions">
          <LanguageMenu />
          <Link href={p.kind === "prospect_pack" ? "/" : "/checkout"} className="checkout-back"><ArrowLeft className="flip-rtl" /> {t.checkout.back}</Link>
        </div>
      </header>
      <main className="checkout-pay">
        <div className="checkout-line"><span><span>{what}</span></span><span dir="ltr" translate="no">{formatMoney(Number(p.amount), p.currency, true)}</span></div>
        <KashierFrame url={p.checkout_url} paymentId={p.id} />
      </main>
    </div>
  );
}
