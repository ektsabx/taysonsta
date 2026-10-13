import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, KpiCard, StatusBadge } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { getT } from "@/lib/bos/i18n/server";
import { formatDateTime } from "@/lib/bos/format";
import type { Tone } from "@/lib/bos/labels";
import { NotConnected, MigrationNeeded, trackingReady, connected, num, Pager, qsFor } from "@/components/yolias/PlatformUi";
import { PeriodPicker } from "@/components/yolias/PeriodPicker";
import { pct } from "@/components/yolias/AccountBits";
import { period, trialsOverview } from "@/services/yolias/conversions";

const STATE: Record<string, { label: string; tone: Tone }> = {
  active: { label: "تجربة نشطة", tone: "info" },
  canceling: { label: "ألغى قبل انتهاء التجربة", tone: "warning" },
  converted: { label: "تحول إلى مدفوع", tone: "success" },
  ended: { label: "انتهت دون اشتراك", tone: "neutral" },
  canceled: { label: "أُلغيت", tone: "neutral" },
  payment_failed: { label: "فشل الدفع بعد التجربة", tone: "danger" },
};
const hours = (h: number | null) => (h == null ? "—" : h < 48 ? `${Math.round(h)} ساعة` : `${Math.round(h / 24)} يوم`);

// Free trials (D-212): the trial is started by Polar with a saved card and
// charged after the trial unless canceled (D-190); Paymob (Egypt) has no trial.
export default async function TrialsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="التجارب المجانية" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="التجارب المجانية" /><MigrationNeeded /></>);
  const sp = await readParams(searchParams);
  const t = await getT();
  const p = period(sp);
  const page = pageOf(sp);
  const d = await trialsOverview(p.since, p.until, page, sp.state);
  const B = "/admin/platform/conversions/trials";
  return (
    <>
      <PageHeader title="التجارب المجانية" subtitle={<Tx vars={{ p: p.label }}>{"رحلة مستخدمي التجربة · الأحداث في الفترة: {p}"}</Tx>} />
      <PeriodPicker base={B} sp={sp} />
      <div className="bos-kpis">
        <KpiCard label="بدأوا التجربة (في الفترة)" value={num(d.started)} />
        <KpiCard label="تجارب نشطة الآن" value={num(d.active)} href={`${B}?state=active`} />
        <KpiCard label="تنتهي خلال 3 أيام" value={num(d.endingSoon)} />
        <KpiCard label="انتهت (في الفترة)" value={num(d.ended)} />
        <KpiCard label="تحولت إلى مدفوع (في الفترة)" value={num(d.converted)} href={`${B}?state=converted`} />
        <KpiCard label="انتهت دون اشتراك" value={num(d.endedWithoutPaying)} href={`${B}?state=ended`} />
        <KpiCard label="ألغوا قبل نهاية التجربة" value={num(d.canceledBeforeEnd)} href={`${B}?state=canceling`} />
        <KpiCard label="فشل الدفع بعد التجربة" value={num(d.failedAfterTrial)} href={`${B}?state=payment_failed`} />
        <KpiCard label="تحويل التجربة إلى مدفوع" value={pct(d.conversionRate)} sub={<Tx>للتجارب التي بدأت في الفترة</Tx>} />
        <KpiCard label="معدل الإلغاء قبل الدفع" value={pct(d.cancelRate)} />
        <KpiCard label="من التسجيل إلى بدء التجربة" value={hours(d.avgHoursSignupToTrial)} sub={<Tx>متوسط</Tx>} />
        <KpiCard label="من بدء التجربة إلى أول دفع" value={hours(d.avgHoursTrialToPaid)} sub={<Tx>متوسط</Tx>} />
      </div>
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Link href={B} className={`admin-btn small${!sp.state ? "" : " ghost"}`}><Tx>الكل</Tx></Link>
        {Object.entries(STATE).map(([k, v]) => <Link key={k} href={`${B}?state=${k}`} className={`admin-btn small${sp.state === k ? "" : " ghost"}`}><Tx>{v.label}</Tx></Link>)}
      </div>
      <Card flush>
        {d.rows.length ? (
          <div className="bos-table-scroll"><table className="bos-table responsive stacked">
            <thead><tr><th><Tx>المالك</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>بداية التجربة</Tx></th><th><Tx>نهاية التجربة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>أول دفع</Tx></th></tr></thead>
            <tbody>{d.rows.map((r) => (
              <tr key={r.id}>
                <td data-label={t("المالك")} className="cell-main">{r.owner ? <Link className="bos-link" href={`/admin/platform/users/${r.owner.id}`}>{r.owner.full_name || r.owner.email}</Link> : r.name ?? "—"}{r.owner ? <span className="cell-sub" dir="ltr">{r.owner.email}</span> : null}</td>
                <td data-label={t("الخطة")} dir="ltr">{r.plan} · {r.billing_period}</td>
                <td data-label={t("بداية التجربة")}>{r.trial_started_at ? formatDateTime(r.trial_started_at) : "—"}</td>
                <td data-label={t("نهاية التجربة")}>{r.trial_ends_at ? formatDateTime(r.trial_ends_at) : "—"}</td>
                <td data-label={t("الحالة")}><StatusBadge tone={STATE[r.state]?.tone ?? "neutral"} label={STATE[r.state]?.label ?? r.state} /></td>
                <td data-label={t("أول دفع")}>{r.paidAt ? formatDateTime(r.paidAt) : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <EmptyState title="لا توجد تجارب" />}
        <Pager page={page} pages={d.pages} href={qsFor(B, sp)} />
      </Card>
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>التجربة متاحة مع الدفع بالبطاقة (Polar) فقط: البطاقة تُحفظ عند Polar ويُخصم أول دفع بعد التجربة إذا لم يُلغِ المستخدم. الدفع من مصر (Paymob) بلا تجربة.</Tx></p>
    </>
  );
}
