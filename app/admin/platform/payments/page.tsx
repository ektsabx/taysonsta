import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import type { Tone } from "@/lib/bos/labels";
import { yoliasPlanLabel } from "@/lib/yolias/plans";
import { getPaymobSettings, listPacks, paymentTotals, recentPayments } from "@/services/yolias/payments";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { PackForm, PaymentSecretForm, PaymobForm } from "./PaymentForms";

const statusTone: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "قيد الانتظار", tone: "info" },
  succeeded: { label: "ناجحة", tone: "success" },
  failed: { label: "فاشلة", tone: "danger" },
  refunded: { label: "مستردة", tone: "neutral" },
};
const money = (v: number, c: string) => `${c} ${num(Math.round(v * 100) / 100)}`;

// Payments (final spec phase 3): the payment provider (Paymob, secrets in
// Vault), Buy More Prospects packs, and every payment with its status.
// Amounts stay in their own currency (USD / EGP), never converted.
export default async function PaymentsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المدفوعات" /><NotConnected /></>);
  const [s, packs, payments, totals] = await Promise.all([getPaymobSettings(), listPacks(), recentPayments(), paymentTotals(30)]);
  const manage = can(bos, "platform.manage", "all");
  const site = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");

  return (
    <>
      <PageHeader title="المدفوعات" subtitle="مزود الدفع، باقات العملاء المحتملين الإضافية، وكل عملية دفع. مصر بالجنيه وباقي الدول بالدولار، بدون تحويل." />
      <div className="bos-kpis">
        {(["EGP", "USD"] as const).map((c) => {
          const live = totals[`${c}:live`];
          return <KpiCard key={c} label={`مدفوعات ناجحة · ${c} · آخر 30 يوماً`} value={live ? money(live.amount, c) : "—"} sub={live ? <Tx vars={{ n: live.succeeded, f: live.failed }}>{"{n} ناجحة · {f} فاشلة"}</Tx> : undefined} />;
        })}
      </div>

      <Card title="Paymob">
        <KeyValues items={[
          { label: "الحالة", value: s.enabled ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="غير متصل" /> },
          { label: "الوضع", value: s.mode === "live" ? <Tx>حقيقي</Tx> : <Tx>تجريبي</Tx> },
          { label: "المفتاح السري", value: s.secrets.secret_key.set ? <span dir="ltr">•••• {s.secrets.secret_key.hint}</span> : <Tx>غير محدد</Tx> },
          { label: "سر HMAC", value: s.secrets.hmac_secret.set ? <span dir="ltr">•••• {s.secrets.hmac_secret.hint}</span> : <Tx>غير محدد</Tx> },
          { label: "رابط الإشعارات (Transaction processed callback)", value: <span dir="ltr">{site ? `${site}/api/payments/paymob` : "—"}</span> },
          { label: "رابط العودة (Transaction response callback)", value: <span dir="ltr">{site ? `${site}/api/payments/paymob/return` : "—"}</span> },
          { label: "آخر تعديل", value: s.updatedBy ? `${s.updatedBy} · ${formatDateTime(s.updatedAt)}` : "—" },
        ]} />
        {manage && (
          <>
            <PaymobForm s={{ enabled: s.enabled, mode: s.mode, baseUrl: s.baseUrl, publicKey: s.publicKey, egp: s.integrations.EGP.join(", "), usd: s.integrations.USD.join(", ") }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 16 }}>
              <PaymentSecretForm name="secret_key" label="المفتاح السري (Secret key)" isSet={s.secrets.secret_key.set} />
              <PaymentSecretForm name="hmac_secret" label="سر HMAC" isSet={s.secrets.hmac_secret.set} />
            </div>
          </>
        )}
      </Card>

      <Card title="باقات العملاء المحتملين الإضافية">
        {packs.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>العملاء المحتملون</Tx></th><th><Tx>السعر (USD)</Tx></th><th><Tx>السعر (EGP)</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>آخر تعديل</Tx></th></tr></thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id}>
                  <td className="bos-num">{num(p.prospects)}</td>
                  <td className="bos-num">{money(Number(p.price_usd), "USD")}</td>
                  <td className="bos-num">{p.price_egp == null ? "—" : money(Number(p.price_egp), "EGP")}</td>
                  <td>{p.active ? <StatusBadge tone="success" label="معروضة" /> : <StatusBadge tone="neutral" label="مخفية" />}</td>
                  <td>{p.updated_by ? `${p.updated_by} · ${formatDateTime(p.updated_at)}` : formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد باقات" description="أضف باقة ليظهر زر شراء عملاء محتملين إضافيين للعملاء." />}
        {manage && (
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {packs.map((p) => <details key={p.id}><summary><Tx vars={{ n: num(p.prospects) }}>{"تعديل باقة {n}"}</Tx></summary><PackForm p={{ ...p, price_usd: Number(p.price_usd), price_egp: p.price_egp == null ? null : Number(p.price_egp) }} /></details>)}
            <PackForm />
          </div>
        )}
      </Card>

      <Card title="آخر المدفوعات">
        {payments.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>مساحة العمل</Tx></th><th><Tx>البند</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المرجع</Tx></th></tr></thead>
            <tbody>
              {payments.map((p) => {
                const st = statusTone[p.status] ?? { label: p.status, tone: "neutral" as Tone };
                return (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.created_at)}</td>
                    <td>{p.workspace?.name ?? "—"}</td>
                    <td>{p.kind === "subscription" ? `${yoliasPlanLabel[p.plan as "pro" | "growth"] ?? p.plan} · ${p.billing_period === "annual" ? "سنوي" : "شهري"}` : <Tx vars={{ n: num(p.prospects ?? 0) }}>{"{n} عميل محتمل إضافي"}</Tx>}</td>
                    <td className="bos-num">{money(Number(p.amount), p.currency)}{p.mode === "test" ? <> <StatusBadge tone="neutral" label="تجريبي" /></> : null}</td>
                    <td><StatusBadge tone={st.tone} label={st.label} />{p.failure_reason ? <div className="bos-faint" style={{ fontSize: 12 }}>{p.failure_reason}</div> : null}</td>
                    <td dir="ltr" style={{ fontSize: 12 }}>{p.provider} {p.provider_txn ?? p.provider_ref ?? ""}</td>
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
