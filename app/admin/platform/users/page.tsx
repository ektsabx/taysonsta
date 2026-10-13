import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, KpiCard } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, MigrationNeeded, trackingReady, connected, num } from "@/components/yolias/PlatformUi";
import { PeriodPicker } from "@/components/yolias/PeriodPicker";
import { pct, segmentLabel } from "@/components/yolias/AccountBits";
import { accountsOverview, segmentCounts, SEGMENTS } from "@/services/yolias/accounts";
import { period } from "@/services/yolias/conversions";

// Users → Overview (D-214). Every number is a count over the same view the
// user tables read, so a card and its list always agree.
export default async function UsersOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المستخدمون" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="المستخدمون" /><MigrationNeeded /></>);
  const sp = await readParams(searchParams);
  const p = period(sp);
  const [o, seg] = await Promise.all([accountsOverview(p.since, p.until), segmentCounts()]);
  const L = "/admin/platform/users";
  const range = sp.from ? `from=${sp.from}${sp.to ? `&to=${sp.to}` : ""}` : "";
  return (
    <>
      <PageHeader title="المستخدمون — نظرة عامة" subtitle={<Tx vars={{ p: p.label }}>{"أرقام من البيانات الفعلية · الفترة: {p}"}</Tx>} />
      <PeriodPicker base={L} sp={sp} />
      <div className="bos-kpis">
        <KpiCard label="إجمالي الحسابات" value={num(o.total)} href={`${L}/all`} />
        <KpiCard label="مسجلون جدد في الفترة" value={num(o.newInPeriod)} href={`${L}/all?${range || `from=${p.since.slice(0, 10)}`}`} />
        <KpiCard label="لم يشتركوا بعد" value={num(o.notSubscribed)} sub={<Tx>لا دفع ولا تجربة</Tx>} href={`${L}/registered?sub=none`} />
        <KpiCard label="في التجربة المجانية الآن" value={num(o.trialing)} href={`${L}/subscribed?sub=trialing`} />
        <KpiCard label="مشتركون مدفوعون نشطون" value={num(o.paidActive)} href={`${L}/subscribed?segment=paid_active`} />
        <KpiCard label="اشتراكات منتهية" value={num(o.ended)} href={`${L}/subscribed?sub=canceled`} />
        <KpiCard label="ملغاة وما زالت سارية" value={num(o.canceledRunning)} sub={<Tx vars={{ n: num(o.canceledInPeriod) }}>{"{n} إلغاء في الفترة"}</Tx>} />
        <KpiCard label="موقوفون" value={num(o.suspended)} href={`${L}/suspended`} />
        <KpiCard label="محظورون" value={num(o.banned)} href={`${L}/banned`} />
        <KpiCard label="تجارب تنتهي خلال 3 أيام" value={num(o.trialSoon)} href={`${L}/subscribed?sub=trialing&sort=trial_end&dir=asc`} />
        <KpiCard label="اشتراكات تنتهي خلال 7 أيام" value={num(o.periodSoon)} href={`${L}/subscribed?sub=active&sort=period_end&dir=asc`} />
        <KpiCard label="تحويل المسجلين إلى مدفوعين" value={pct(o.conversion)} sub={<Tx vars={{ a: num(o.newPaid), b: num(o.newInPeriod) }}>{"{a} من {b} سجلوا في الفترة ودفعوا"}</Tx>} />
      </div>

      <Card title="أين يقف المستخدمون في رحلة الاشتراك">
        <p className="bos-faint" style={{ fontSize: 12.5, marginTop: 0 }}><Tx>كل حساب في فئة واحدة حسب آخر حالة مؤكدة. اضغط على الفئة لفتح قائمة الحسابات الفعلية واتخاذ إجراء.</Tx></p>
        <div className="bos-table-scroll"><table className="bos-table">
          <tbody>
            {SEGMENTS.map((s) => (
              <tr key={s}>
                <td><Link className="bos-link" href={`${L}/all?segment=${s}`}><Tx>{segmentLabel[s] ?? s}</Tx></Link></td>
                <td className="bos-num">{num(seg[s] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </>
  );
}
