import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { HBarList } from "@/components/bos/Chart";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, MigrationNeeded, trackingReady, connected, num } from "@/components/yolias/PlatformUi";
import { PeriodPicker } from "@/components/yolias/PeriodPicker";
import { money, pct, providerLabel, segmentLabel } from "@/components/yolias/AccountBits";
import { REASONS, STAGES, conversionOverview, period } from "@/services/yolias/conversions";
import { segmentCounts, SEGMENTS } from "@/services/yolias/accounts";

// Subscriptions & conversions — overview (D-212). People, events and payments
// are counted separately and never added together.
export default async function ConversionsOverview({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الاشتراكات والتحويلات" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="الاشتراكات والتحويلات" /><MigrationNeeded /></>);
  const sp = await readParams(searchParams);
  const p = period(sp);
  const [o, seg] = await Promise.all([conversionOverview(p.since, p.until), segmentCounts()]);
  const stage = (k: string) => o.stages.find((s) => s.stage === k);
  const B = "/admin/platform/conversions";
  const range = sp.from ? `from=${sp.from}${sp.to ? `&to=${sp.to}` : ""}` : `range=${p.days ?? 30}`;
  return (
    <>
      <PageHeader title="الاشتراكات والتحويلات — نظرة عامة" subtitle={<Tx vars={{ p: p.label }}>{"من لحظة رؤية الخطط حتى الدفع أو الترك · {p}"}</Tx>} />
      <PeriodPicker base={B} sp={sp} />
      <div className="bos-kpis">
        <KpiCard label="أشخاص شاهدوا الخطط" value={num(stage("plans_viewed")?.people ?? 0)} sub={<Tx vars={{ n: num(stage("plans_viewed")?.events ?? 0) }}>{"{n} مشاهدة"}</Tx>} href={`${B}/funnel?${range}&stage=plans_viewed`} />
        <KpiCard label="أشخاص اختاروا خطة" value={num(stage("plan_selected")?.people ?? 0)} sub={<Tx vars={{ n: num(stage("plan_selected")?.events ?? 0) }}>{"{n} اختيار"}</Tx>} href={`${B}/funnel?${range}&stage=plan_selected`} />
        <KpiCard label="عمليات Checkout فُتحت" value={num(o.opened)} sub={<Tx vars={{ n: num(stage("checkout_opened")?.people ?? 0) }}>{"{n} شخص"}</Tx>} href={`${B}/abandoned?${range}`} />
        <KpiCard label="بدأوا الدفع" value={num(o.started)} sub={<Tx vars={{ n: num(stage("payment_started")?.people ?? 0) }}>{"{n} شخص"}</Tx>} />
        <KpiCard label="انتقلوا إلى بوابة الدفع" value={num(o.redirected)} sub={<Tx>يسجله الخادم</Tx>} />
        <KpiCard label="مدفوعات ناجحة" value={num(o.paymentsSucceeded)} sub={<Tx vars={{ n: num(o.paymentsPending) }}>{"{n} ما زالت قيد الانتظار"}</Tx>} href="/admin/platform/payments" />
        <KpiCard label="مدفوعات فاشلة" value={num(o.paymentsFailed)} href={`${B}/failed?${range}`} />
        <KpiCard label="Checkout متروك" value={num(o.abandoned)} href={`${B}/abandoned?state=abandoned`} />
        <KpiCard label="اشتراكات فُعّلت" value={num(o.activated)} sub={<Tx>تجربة أو مدفوع</Tx>} />
        <KpiCard label="اشتراكات أُلغيت" value={num(o.canceled)} />
        <KpiCard label="عادوا وأكملوا بعد الترك" value={num(o.recovered)} href={`${B}/abandoned?state=recovered`} />
        <KpiCard label="Checkout ← دفع ناجح" value={pct(o.checkoutToPaid)} />
        <KpiCard label="بدء الدفع ← اشتراك مفعّل" value={pct(o.startedToActive)} />
        <KpiCard label="معدل التخلي عن Checkout" value={pct(o.abandonRate)} />
        <KpiCard label="الإيرادات الفعلية" value={money(o.revenue)} sub={<Tx>مدفوعات حقيقية مؤكدة (USD)</Tx>} />
        <KpiCard label="قيمة محتملة غير مكتملة" value={money(o.potentialValue)} sub={<Tx>تقديرية — ليست إيرادات</Tx>} />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card title="رحلة التحويل (أشخاص فريدون)" actions={<Link className="admin-btn small ghost" href={`${B}/funnel?${range}`}><Tx>التفاصيل</Tx></Link>}>
          {o.stages.length ? <HBarList items={STAGES.map(([k, label]) => ({ label, value: stage(k)?.people ?? 0 }))} format={(v) => num(v)} /> : <EmptyState title="لا توجد أحداث في هذه الفترة" description="التتبع بدأ في 2026-10-13." />}
        </Card>
        <Card title="لماذا لم يكتمل الاشتراك">
          {o.reasons.length ? <HBarList items={o.reasons.map((r) => ({ label: REASONS[r.key] ?? r.key, value: r.count, sub: pct(r.share) }))} format={(v) => num(v)} /> : <EmptyState title="لا توجد حالات" />}
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الأسباب من أدلة مسجلة فقط؛ لا نخمّن السعر أو الاهتمام. ما لا دليل عليه = «سبب غير معروف».</Tx></p>
        </Card>
        <Card title="بوابات الدفع المختارة">
          {o.providers.length ? (
            <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>البوابة</Tx></th><th><Tx>Checkout</Tx></th><th><Tx>اكتمل</Tx></th></tr></thead>
              <tbody>{o.providers.map((x) => <tr key={x.key}><td><Tx>{providerLabel[x.key] ?? (x.key === "—" ? "لم يختر بعد" : x.key)}</Tx></td><td className="bos-num">{num(x.opened)}</td><td className="bos-num">{num(x.activated)}</td></tr>)}</tbody>
            </table></div>
          ) : <EmptyState title="لا توجد بيانات" />}
        </Card>
        <Card title="من لم يشترك — حسب الفئة">
          <div className="bos-table-scroll"><table className="bos-table"><tbody>{SEGMENTS.filter((s) => !["paid_active", "test", "deleted"].includes(s)).map((s) => (
            <tr key={s}><td><Link className="bos-link" href={`/admin/platform/users/all?segment=${s}`}><Tx>{segmentLabel[s]}</Tx></Link></td><td className="bos-num">{num(seg[s] ?? 0)}</td></tr>
          ))}</tbody></table></div>
        </Card>
      </div>
      {o.testPayments ? <p className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ n: o.testPayments }}>{"{n} دفعة اختبار لا تُحتسب في الإيرادات."}</Tx></p> : null}
    </>
  );
}
