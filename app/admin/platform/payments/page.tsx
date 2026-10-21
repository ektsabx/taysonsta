import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import type { Tone } from "@/lib/bos/labels";
import { yoliasPlanLabel } from "@/lib/yolias/plans";
import { getCreditRate, getPaymobSettings, listPacks, paymentTotals, recentPayments, savedCards } from "@/services/yolias/payments";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import Link from "next/link";
import { CreditRateForm, PackForm } from "./PaymentForms";
import { getSwitches } from "@/services/yolias/switches";

const statusTone: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "قيد الانتظار (لم يكمل الدفع لدى المزود)", tone: "info" },
  succeeded: { label: "ناجحة", tone: "success" },
  failed: { label: "فاشلة", tone: "danger" },
  refunded: { label: "مستردة", tone: "neutral" },
};
const money = (v: number, c: string) => `${c} ${num(Math.round(v * 100) / 100)}`;

// Payments (final spec phase 3): the Paymob status (its keys are entered in
// Settings → Integrations, D-132), the Pay As You Go rate and top-up amounts
// (D-247), and every payment with its status.
export default async function PaymentsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المدفوعات" /><NotConnected /></>);
  const [s, cards, packs, payments, totals, sw, rate] = await Promise.all([getPaymobSettings(), savedCards(), listPacks(), recentPayments(), paymentTotals(30), getSwitches(), getCreditRate()]);
  const manage = can(bos, "platform.manage", "all");
  // Active top-up amounts first; retired ones (kept for past payments) are folded away.
  const shown = packs.filter((p) => p.active).sort((a, b) => Number(a.price_usd) - Number(b.price_usd));
  const hidden = packs.filter((p) => !p.active);
  const site = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");

  return (
    <>
      <PageHeader title="المدفوعات" subtitle="مزود الدفع، مبالغ شحن الدفع حسب الاستخدام، وكل عملية دفع." />
      <div className="bos-kpis">
        <KpiCard label="مدفوعات ناجحة · آخر 30 يوماً" value={totals["USD:live"] ? money(totals["USD:live"].amount, "USD") : "—"} sub={totals["USD:live"] ? <Tx vars={{ n: totals["USD:live"].succeeded, f: totals["USD:live"].failed }}>{"{n} ناجحة · {f} فاشلة"}</Tx> : undefined} />
      </div>

      <Card title="ظهور طرق الدفع للعملاء" actions={<Link className="admin-btn small ghost" href="/admin/platform/switches"><Tx>تشغيل / إيقاف</Tx></Link>}>
        <KeyValues items={[
          { label: "الدفع بالكارت (Paymob)", value: sw.values.payments_paymob ? <StatusBadge tone="success" label="ظاهر للعملاء" /> : <StatusBadge tone="neutral" label="موقوف ومخفي" /> },
          { label: "الدفع حسب الاستخدام (شحن الرصيد)", value: sw.values.buy_more ? <StatusBadge tone="success" label="ظاهر للعملاء" /> : <StatusBadge tone="neutral" label="موقوف ومخفي" /> },
        ]} />
      </Card>

      <Card title="Paymob">
        <KeyValues items={[
          { label: "الحالة", value: s.enabled ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="غير متصل" /> },
          { label: "الوضع", value: s.mode === "live" ? <Tx>حقيقي</Tx> : <Tx>تجريبي</Tx> },
          { label: "المفتاح السري", value: s.secrets.secret_key.set ? <span dir="ltr">•••• {s.secrets.secret_key.hint}</span> : <Tx>غير محدد</Tx> },
          { label: "سر HMAC", value: s.secrets.hmac_secret.set ? <span dir="ltr">•••• {s.secrets.hmac_secret.hint}</span> : <Tx>غير محدد</Tx> },
          { label: "رابط الإشعارات (Transaction processed callback)", value: <span dir="ltr">{site ? `${site}/api/payments/paymob` : "—"}</span> },
          { label: "رابط العودة (Transaction response callback)", value: <span dir="ltr">{site ? `${site}/api/payments/paymob/return` : "—"}</span> },
          { label: "أرقام التكامل (USD)", value: s.integrations.USD.length ? <span dir="ltr">{s.integrations.USD.join(", ")}</span> : <Tx>غير محدد</Tx> },
          { label: "تكامل MOTO (التجديد التلقائي)", value: s.motoIntegration ? <span dir="ltr">{s.motoIntegration}</span> : <Tx>غير مفعّل: التجديد فاتورة يدفعها العميل</Tx> },
          { label: "البطاقات المحفوظة للتجديد", value: num(cards) },
          { label: "آخر تعديل", value: s.updatedBy ? `${s.updatedBy} · ${formatDateTime(s.updatedAt)}` : "—" },
        ]} />
        <p className="bos-faint" style={{ fontSize: 12.5, marginTop: 12 }}>
          <Tx>مفاتيح Paymob تُضاف وتُعدّل من مكان واحد: الإعدادات ← مركز التكاملات.</Tx>{" "}
          <Link className="bos-link" href="/admin/settings/integrations?tab=connections&cat=payments"><Tx>فتح مركز التكاملات</Tx></Link>
        </p>
      </Card>

      <Card title="الدفع حسب الاستخدام: مبالغ الشحن">
        <p className="bos-faint" style={{ fontSize: 12.5, marginTop: 0 }}><Tx>رصيد مسبق الدفع بدون اشتراك وبدون تجديد. العميل يختار المبلغ في صفحة الدفع ويرى عدد العملاء المحتملين قبل الدفع، ويُضاف الرصيد بعد تأكيد الدفع فقط.</Tx></p>
        <KeyValues items={[
          { label: "سعر العميل المحتمل الواحد", value: <span dir="ltr">USD {rate.usdPerProspect}</span> },
          { label: "آخر تعديل للسعر", value: rate.updatedAt ? formatDateTime(rate.updatedAt) : "—" },
        ]} />
        {manage && <div style={{ marginTop: 12 }}><CreditRateForm rate={rate.usdPerProspect} /></div>}
        {shown.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المبلغ (USD)</Tx></th><th><Tx>العملاء المحتملون</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>آخر تعديل</Tx></th></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="bos-num">{money(Number(p.price_usd), "USD")}</td>
                  <td className="bos-num">{num(p.prospects)}</td>
                  <td>{p.active ? <StatusBadge tone="success" label="معروض" /> : <StatusBadge tone="neutral" label="مخفي" />}</td>
                  <td>{p.updated_by ? `${p.updated_by} · ${formatDateTime(p.updated_at)}` : formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد مبالغ شحن" description="أضف مبلغًا ليظهر خيار الدفع حسب الاستخدام للعملاء." />}
        {manage && (
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {shown.map((p) => <details key={p.id}><summary><Tx vars={{ n: money(Number(p.price_usd), "USD") }}>{"تعديل مبلغ {n}"}</Tx></summary><PackForm p={{ ...p, price_usd: Number(p.price_usd) }} /></details>)}
            {hidden.length > 0 && (
              <details><summary><Tx vars={{ n: hidden.length }}>{"مبالغ مخفية ({n})"}</Tx></summary>
                <div style={{ display: "grid", gap: 12, marginTop: 8 }}>{hidden.map((p) => <details key={p.id}><summary><Tx vars={{ n: money(Number(p.price_usd), "USD"), c: num(p.prospects) }}>{"{n} · {c} عميل محتمل"}</Tx></summary><PackForm p={{ ...p, price_usd: Number(p.price_usd) }} /></details>)}</div>
              </details>
            )}
            <PackForm />
          </div>
        )}
      </Card>

      <Card title="آخر المدفوعات">
        {payments.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>مساحة العمل</Tx></th><th><Tx>البند</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المرجع</Tx></th><th /></tr></thead>
            <tbody>
              {payments.map((p) => {
                const st = statusTone[p.status] ?? { label: p.status, tone: "neutral" as Tone };
                return (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.created_at)}</td>
                    <td>{p.created_by ? <Link className="bos-link" href={`/admin/platform/users/${p.created_by}`}>{p.workspace?.name || "—"}</Link> : p.workspace?.name ?? "—"}</td>
                    <td>{p.kind === "subscription" ? `${yoliasPlanLabel[p.plan as "pro" | "growth"] ?? p.plan} · ${p.billing_period === "annual" ? "سنوي" : "شهري"}` : <Tx vars={{ n: num(p.prospects ?? 0) }}>{"شحن رصيد · {n} عميل محتمل"}</Tx>}</td>
                    <td className="bos-num">{money(Number(p.amount), p.currency)}{p.charge_currency && p.charge_currency !== p.currency ? <div className="bos-faint" style={{ fontSize: 12 }}>{money(Number(p.charge_amount), p.charge_currency)}</div> : null}{p.mode === "test" ? <> <StatusBadge tone="neutral" label="تجريبي" /></> : null}</td>
                    <td><StatusBadge tone={st.tone} label={st.label} />{p.failure_reason ? <div className="bos-faint" style={{ fontSize: 12 }}>{p.failure_reason}</div> : null}</td>
                    <td dir="ltr" style={{ fontSize: 12 }}>{p.provider} {p.provider_txn ?? p.provider_ref ?? ""}</td>
                    <td>{p.checkout_id ? <Link className="bos-link" href={`/admin/platform/conversions/abandoned/${p.checkout_id}`}>Checkout</Link> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد مدفوعات بعد" />}
      </Card>
    </>
  );
}
