import Link from "next/link";
import type { ReactNode } from "react";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { PeriodTabs, SeoNotReady, pct, pos } from "@/components/yolias/SeoUi";
import { reports, sourcesState } from "@/services/yolias/seo/metrics";
import { seoReady } from "@/services/yolias/seo/indexing";

// Business reports for SEO (D-257): which pages and topics bring accounts
// that pay, what isn't working and what to do next. Attribution is first
// touch on the visit that created the account (see the note at the end).
export default async function SeoReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="التقارير التجارية" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="التقارير التجارية" /><SeoNotReady /></>);
  const [r, src] = await Promise.all([reports(Number((await searchParams).days ?? 28)), sourcesState()]);
  const P = ({ p }: { p: string }) => <span dir="ltr">{p}</span>;
  const table = (head: string[], rows: ReactNode[][], empty: string) => rows.length ? (
    <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr>{head.map((h) => <th key={h}><Tx>{h}</Tx></th>)}</tr></thead><tbody>{rows.map((cells, i) => <tr key={i}>{cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></BosTable></div>
  ) : <EmptyState title={empty} />;
  const noGsc = !src.gsc ? <p className="bos-faint" style={{ fontSize: 12 }}><Tx>يحتاج Search Console.</Tx> <Link className="bos-link" href="/admin/platform/seo/settings"><Tx>طريقة الربط</Tx></Link></p> : null;
  return (
    <>
      <PageHeader title="التقارير التجارية" subtitle={<Tx vars={{ from: r.period.from, to: r.period.to }}>{"من {from} إلى {to}"}</Tx>} />
      <PeriodTabs days={r.period.days} base="/admin/platform/seo/reports" />
      <div className="bos-grid cols-2">
        <Card title="1. الصفحات التي جلبت أكثر تسجيلات">
          {table(["الصفحة", "تسجيلات", "تجارب", "دفعوا"], r.topSignups.map((x) => [<P key="p" p={x.page} />, num(x.signups), num(x.trials), num(x.paid)]), "لا توجد تسجيلات عضوية بعد")}
        </Card>
        <Card title="2. أعلى معدل تحويل إلى مستخدمين">
          {noGsc}
          {table(["الصفحة", "نقرات", "تسجيلات", "المعدل"], r.topRate.map((x) => [<P key="p" p={x.page} />, num(x.clicks), num(x.signups), pct(x.rate, 1)]), "لا يوجد (10 نقرات على الأقل)")}
        </Card>
        <Card title="3. مجموعات الكلمات التي جلبت عملاء دفعوا">
          {table(["المجموعة", "نقرات", "تسجيلات", "دفعوا", "الإيراد"], r.clusters.map((x) => [<span key="c" dir="auto">{x.cluster}</span>, num(x.clicks), num(x.signups), num(x.paid), `$${num(Math.round(x.revenue))}`]), "لا يوجد: اربط الكلمات بصفحاتها من الكلمات والفرص")}
        </Card>
        <Card title="4. الجهد مقابل النتيجة">
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الجهد هنا عدد مرات الحفظ وعمر الصفحة بالأيام؛ لا يُسجَّل وقت العمل نفسه.</Tx></p>
          {table(["الصفحة", "مرات الحفظ", "العمر (يوم)", "نقرات", "تسجيلات", "دفعوا"], r.effort.slice(0, 20).map((x) => [<span key="t" dir="auto">{x.title}<span className="cell-sub" dir="ltr">{x.page}</span></span>, num(x.saves), num(x.ageDays), num(x.clicks), num(x.signups), num(x.paid)]), "لا توجد صفحات SEO بعد")}
        </Card>
        <Card title="5. ظهور بدون نقرات كافية">
          {noGsc}
          {table(["الصفحة", "مرات الظهور", "نسبة النقر", "الترتيب"], r.lowCtr.map((x) => [<P key="p" p={x.page} />, num(x.impressions), pct(x.ctr, 2), pos(x.position)]), "لا يوجد")}
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>جرّب عنوانًا ووصفًا أوضح لنية البحث، أو أجب عن السؤال في أول الصفحة.</Tx></p>
        </Card>
        <Card title="6. زيارات بدون تحويل">
          {noGsc}
          {table(["الصفحة", "نقرات", "تسجيلات"], r.noConversions.map((x) => [<P key="p" p={x.page} />, num(x.clicks), num(x.signups)]), "لا يوجد")}
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>راجع هل الزائر هو الجمهور المناسب، ووضوح الدعوة لاتخاذ إجراء، والربط بصفحات المنتج.</Tx></p>
        </Card>
        <Card title="7. موضوعات تستحق صفحات إضافية">
          {noGsc}
          {table(["عبارة البحث", "مرات الظهور", "نقرات", "الترتيب", "تظهر في"], r.opportunities.map((x) => [<span key="q" dir="auto">{x.query}</span>, num(x.impressions), num(x.clicks), pos(x.position), <span key="p" dir="ltr">{x.pages.slice(0, 2).join(", ")}</span>]), "لا يوجد: عبارات لها 30 ظهورًا على الأقل وليست في خطة الكلمات")}
          {r.opportunities.length > 0 && <p className="bos-faint" style={{ fontSize: 12 }}><Tx>أضف المناسب منها في الكلمات والفرص، وحدّد الصفحة التي تخدمه.</Tx></p>}
        </Card>
        <Card title="8. صفحات تحتاج تحديثًا أو دمجًا أو تحويلًا">
          {r.cannibal.length > 0 && (<><p style={{ fontSize: 13, fontWeight: 600 }}><Tx>عبارات تظهر لها أكثر من صفحة (قد تتنافس):</Tx></p>
            {table(["عبارة البحث", "الصفحات", "مرات الظهور"], r.cannibal.map((x) => [<span key="q" dir="auto">{x.query}</span>, <span key="p" dir="ltr">{x.pages.join(", ")}</span>, num(x.impressions)]), "")}</>)}
          {r.stale.length > 0 && <p style={{ fontSize: 13 }}><Tx vars={{ list: r.stale.map((c) => c.name).join("، ") }}>{"معلومات منافسين لم تُراجع منذ أكثر من 90 يومًا: {list}"}</Tx> <Link className="bos-link" href="/admin/platform/seo/competitors"><Tx>المنافسون</Tx></Link></p>}
          {r.invisible.length > 0 && <p style={{ fontSize: 13 }}><Tx vars={{ list: r.invisible.map((x) => x.page).join(", ") }}>{"منشورة منذ أكثر من 30 يومًا بدون أي ظهور: {list}"}</Tx></p>}
          {!r.cannibal.length && !r.stale.length && !r.invisible.length && <EmptyState title="لا يوجد" />}
        </Card>
        <Card title="9. البحث باسم يولياس">
          {noGsc}
          {src.gsc && (
            <p style={{ fontSize: 13 }}>
              <Tx vars={{ i: num(r.brand.en.impressions), c: num(r.brand.en.clicks), p: pos(r.brand.en.position) }}>{"بالإنجليزية: {i} ظهور، {c} نقرة، متوسط الترتيب {p}"}</Tx><br />
              <Tx vars={{ i: num(r.brand.ar.impressions), c: num(r.brand.ar.clicks), p: pos(r.brand.ar.position) }}>{"بالعربية: {i} ظهور، {c} نقرة، متوسط الترتيب {p}"}</Tx>
            </p>
          )}
          {table(["عبارة البحث", "مرات الظهور", "نقرات", "الترتيب"], r.brand.queries.map((x) => [<span key="q" dir="auto">{x.query}</span>, num(x.impressions), num(x.clicks), pos(x.position)]), "لا توجد عمليات بحث باسم يولياس في هذه الفترة")}
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>كل عبارة فيها Yolias أو يولياس أو أخطاء كتابتها الشائعة. الترتيب الأقرب لـ 1 أفضل.</Tx></p>
        </Card>
      </div>
      <Card title="حدود الإسناد">
        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.8 }}>
          <li><Tx>التسجيل يُنسب إلى البحث العضوي عندما تكون أول صفحة في زيارته جاءت من محرك بحث. تُحفظ أول صفحة لكل زائر (من 2026-10-28)، فـ«بلا مصدر معروف» تعني تسجيلًا قبل ذلك أو من جهاز آخر أو متصفح يمنع ملفات الارتباط.</Tx></li>
          <li><Tx>الإسناد لأول زيارة فقط: من عاد لاحقًا من مصدر آخر وسجّل يُنسب للأول خلال 30 يومًا.</Tx></li>
          <li><Tx>رابط الدخول المفتوح على جهاز آخر غير الذي زار منه الموقع يفقد المصدر.</Tx></li>
          <li><Tx>«دفعوا» تشمل الاشتراكات وشراء الرصيد؛ الإيراد مدفوعات حقيقية بالدولار فقط.</Tx></li>
          <li><Tx>Search Console يُظهر بيانات بعد يومين تقريبًا، ويخفي بعض العبارات النادرة لحماية الخصوصية، فمجموع العبارات أقل من مجموع الصفحات.</Tx></li>
        </ul>
      </Card>
    </>
  );
}
