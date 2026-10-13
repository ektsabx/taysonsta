import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, KpiCard } from "@/components/bos/ui";
import { HBarList } from "@/components/bos/Chart";
import { Tx } from "@/components/bos/I18n";
import { getT } from "@/lib/bos/i18n/server";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, MigrationNeeded, trackingReady, connected, num, Pager, qsFor } from "@/components/yolias/PlatformUi";
import { PeriodPicker } from "@/components/yolias/PeriodPicker";
import { pct } from "@/components/yolias/AccountBits";
import { failedPayments, period } from "@/services/yolias/conversions";

// Failed payments (D-212): only failures confirmed by the provider (or a
// checkout that couldn't open). A missing success is not a failure.
export default async function FailedPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="فشل الدفع" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="فشل الدفع" /><MigrationNeeded /></>);
  const sp = await readParams(searchParams);
  const t = await getT();
  const p = period(sp);
  const page = pageOf(sp);
  const d = await failedPayments(p.since, p.until, page, sp.provider);
  const B = "/admin/platform/conversions/failed";
  return (
    <>
      <PageHeader title="فشل الدفع" subtitle={<Tx vars={{ p: p.label }}>{"فشل مؤكد من مزود الدفع أو من Yolias · {p}"}</Tx>} />
      <PeriodPicker base={B} sp={sp} />
      <div className="bos-kpis">
        <KpiCard label="مدفوعات فاشلة مؤكدة" value={num(d.total)} />
        <KpiCard label="Checkout تعذّر فتحه (خطأ تقني)" value={num(d.technical)} href="/admin/platform/conversions/abandoned?reason=technical_error" />
      </div>
      <Card title="أكثر أسباب الفشل">
        {d.reasons.length ? <HBarList items={d.reasons.map((r) => ({ label: r.key === "checkout_failed" ? "تعذّر إنشاء جلسة الدفع لدى المزود" : r.key, value: r.n, sub: pct(r.share) }))} format={(v) => num(v)} /> : <EmptyState title="لا توجد مدفوعات فاشلة في هذه الفترة" />}
        <p className="bos-faint" style={{ fontSize: 12 }}><Tx>النص كما يرسله مزود الدفع. لا تُعرض بيانات البطاقة أبدًا.</Tx></p>
      </Card>
      <Card flush>
        {d.rows.length ? (
          <div className="bos-table-scroll"><table className="bos-table responsive stacked">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المستخدم</Tx></th><th><Tx>البند</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>المزود والمرجع</Tx></th><th><Tx>سبب الفشل</Tx></th><th>Checkout</th></tr></thead>
            <tbody>{d.rows.map((r) => (
              <tr key={r.id}>
                <td data-label={t("الوقت")} className="cell-main">{formatDateTime(r.created_at)}</td>
                <td data-label={t("المستخدم")}>{r.user ? <Link className="bos-link" href={`/admin/platform/users/${r.user.id}`}>{r.user.full_name || r.user.email}</Link> : "—"}{r.user ? <span className="cell-sub" dir="ltr">{r.user.email}</span> : null}</td>
                <td data-label={t("البند")} dir="ltr">{r.kind === "subscription" ? `${r.plan} · ${r.billing_period}` : `+${r.prospects}`}</td>
                <td data-label={t("المبلغ")} className="bos-num">{r.currency} {Number(r.amount)}{r.charge_currency && r.charge_currency !== r.currency ? <span className="cell-sub">{r.charge_currency} {Number(r.charge_amount)}</span> : null}{r.mode === "test" ? <span className="cell-sub"><Tx>اختبار</Tx></span> : null}</td>
                <td data-label={t("المزود والمرجع")} dir="ltr" style={{ fontSize: 12 }}>{r.provider} {r.provider_txn ?? r.provider_ref ?? ""}</td>
                <td data-label={t("سبب الفشل")}>{r.failure_reason ?? <Tx>غير مذكور</Tx>}</td>
                <td data-label={t("Checkout")}>{r.checkout_id ? <Link className="bos-link" href={`/admin/platform/conversions/abandoned/${r.checkout_id}`}><Tx>فتح</Tx></Link> : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <EmptyState title="لا توجد مدفوعات فاشلة" />}
        <Pager page={page} pages={d.pages} href={qsFor(B, sp)} />
      </Card>
    </>
  );
}
