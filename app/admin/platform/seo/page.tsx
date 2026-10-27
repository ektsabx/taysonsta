import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { LineChart } from "@/components/bos/Chart";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { PeriodTabs, SeoNotReady, SourceNote, delta, pct, pos } from "@/components/yolias/SeoUi";
import { overview } from "@/services/yolias/seo/metrics";
import { seoReady } from "@/services/yolias/seo/indexing";

// SEO performance (D-257): search visibility, organic visits and what they
// became (sign-ups, trials, paying accounts, revenue). Real numbers only; a
// source that isn't connected says so instead of showing zero. The live page
// check that used to be here is in SEO → Indexing.
export default async function SeoOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="أداء SEO" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="أداء SEO" /><SeoNotReady /></>);
  const o = await overview(Number((await searchParams).days ?? 28));
  const page = (p: string) => <span dir="ltr">{p}</span>;
  const g = o.gsc;
  const clicks = g ? delta(g.clicks, g.prev.clicks) : null;
  const impr = g ? delta(g.impressions, g.prev.impressions) : null;
  const sess = o.ga4 ? delta(o.ga4.sessions, o.ga4.prev) : null;
  const sign = delta(o.signups.organic, o.signups.organicPrev);
  const paid = delta(o.paid, o.paidPrev);
  return (
    <>
      <PageHeader title="أداء SEO" subtitle={<Tx vars={{ from: o.period.from, to: o.period.to }}>{"من {from} إلى {to}، مقارنة بالفترة السابقة بنفس الطول"}</Tx>} />
      <PeriodTabs days={o.period.days} base="/admin/platform/seo" />
      <div className="bos-kpis">
        <KpiCard label="النقرات العضوية" value={g ? num(g.clicks) : "—"} sub={clicks ? clicks.text : "Search Console غير متصل"} trend={clicks?.trend} />
        <KpiCard label="مرات الظهور" value={g ? num(g.impressions) : "—"} sub={impr?.text} trend={impr?.trend} />
        <KpiCard label="متوسط نسبة النقر" value={g ? pct(g.ctr, 2) : "—"} sub={g ? <Tx vars={{ v: pct(g.prev.ctr, 2) }}>{"قبلها {v}"}</Tx> : undefined} />
        <KpiCard label="متوسط الترتيب" value={g ? pos(g.position) : "—"} sub={g ? <Tx vars={{ v: pos(g.prev.position) }}>{"قبلها {v}"}</Tx> : undefined} />
        <KpiCard label="الزيارات العضوية" value={o.ga4 ? num(o.ga4.sessions) : "—"} sub={sess ? sess.text : "GA4 غير متصل"} trend={sess?.trend} />
        <KpiCard label="صفحات الدخول من البحث" value={o.ga4 ? num(o.ga4.landingPages) : "—"} />
      </div>
      <div className="bos-kpis">
        <KpiCard label="التسجيلات العضوية" value={num(o.signups.organic)} sub={sign.text} trend={sign.trend} />
        <KpiCard label="تجارب مفعّلة" value={num(o.trials)} sub={delta(o.trials, o.trialsPrev).text} />
        <KpiCard label="حسابات دفعت" value={num(o.paid)} sub={paid.text} trend={paid.trend} />
        <KpiCard label="معدل التحويل العضوي" value={o.conversion ? pct(o.conversion.rate, 2) : "—"} sub={o.conversion ? (o.conversion.base === "ga4" ? "تسجيلات ÷ زيارات GA4" : "تسجيلات ÷ نقرات Search Console") : "يحتاج Search Console أو GA4"} />
        <KpiCard label="إيراد من البحث العضوي" value={o.paid ? `$${num(Math.round(o.revenue))}` : "—"} sub="مدفوعات حقيقية بالدولار لحسابات أول زيارتها من البحث" />
        <KpiCard label="تسجيلات بلا مصدر معروف" value={num(o.signups.unknown)} sub={<Tx vars={{ n: num(o.signups.all) }}>{"من {n} تسجيل في الفترة"}</Tx>} />
      </div>
      <SourceNote {...o.sources} />

      <Card title="النقرات ومرات الظهور يوميًا">
        {g ? (
          <LineChart labels={o.trend.labels.map((l) => l.slice(5))} series={[{ name: "النقرات", values: o.trend.clicks }, { name: "مرات الظهور", values: o.trend.impressions }]} />
        ) : (
          <EmptyState title="Search Console غير متصل" description="اربط حساب الخدمة من SEO ← تكاملات SEO، وتظهر الأرقام بعد أول مزامنة." actions={<Link className="admin-btn" href="/admin/platform/seo/settings"><Tx>طريقة الربط</Tx></Link>} />
        )}
      </Card>
      <Card title="التسجيلات العضوية يوميًا">
        <LineChart labels={o.trend.labels.map((l) => l.slice(5))} series={[{ name: "التسجيلات", values: o.trend.signups }]} height={140} />
      </Card>

      {g && (
        <div className="bos-grid cols-2">
          <Card title="صفحات تحسّنت">
            {o.up.length ? (
              <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>الصفحة</Tx></th><th><Tx>النقرات</Tx></th><th><Tx>التغيير</Tx></th></tr></thead>
                <tbody>{o.up.map((m) => <tr key={m.page}><td>{page(m.page)}</td><td>{num(m.clicks)}</td><td dir="ltr">+{num(m.delta)}</td></tr>)}</tbody></BosTable></div>
            ) : <EmptyState title="لا يوجد" />}
          </Card>
          <Card title="صفحات تراجعت">
            {o.down.length ? (
              <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>الصفحة</Tx></th><th><Tx>النقرات</Tx></th><th><Tx>التغيير</Tx></th></tr></thead>
                <tbody>{o.down.map((m) => <tr key={m.page}><td>{page(m.page)}</td><td>{num(m.clicks)}</td><td dir="ltr">{num(m.delta)}</td></tr>)}</tbody></BosTable></div>
            ) : <EmptyState title="لا يوجد" />}
          </Card>
          <Card title="ظهور مرتفع ونسبة نقر منخفضة">
            {o.lowCtr.length ? (
              <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>الصفحة</Tx></th><th><Tx>مرات الظهور</Tx></th><th><Tx>نسبة النقر</Tx></th><th><Tx>الترتيب</Tx></th></tr></thead>
                <tbody>{o.lowCtr.map((s) => <tr key={s.page}><td>{page(s.page)}</td><td>{num(s.impressions)}</td><td>{pct(s.ctr, 2)}</td><td>{pos(s.position)}</td></tr>)}</tbody></BosTable></div>
            ) : <EmptyState title="لا يوجد" description="100 ظهور أو أكثر ونسبة نقر أقل من 1%" />}
          </Card>
          <Card title="زيارات بلا تسجيلات">
            {o.noConversions.length ? (
              <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>الصفحة</Tx></th><th><Tx>النقرات</Tx></th></tr></thead>
                <tbody>{o.noConversions.map((s) => <tr key={s.page}><td>{page(s.page)}</td><td>{num(s.clicks)}</td></tr>)}</tbody></BosTable></div>
            ) : <EmptyState title="لا يوجد" description="20 نقرة أو أكثر بدون أي تسجيل" />}
          </Card>
        </div>
      )}
    </>
  );
}
