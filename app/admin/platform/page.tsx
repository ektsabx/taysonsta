import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { getLocale } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { growthDashboard, type Mode } from "@/services/yolias/growth";
import { Group, Panel, Stat } from "@/components/yolias/dash/Stat";
import { BarChart, Funnel, LineChart } from "@/components/yolias/dash/Charts";
import { GeoMap } from "@/components/yolias/dash/GeoMap";
import { SortTable } from "@/components/yolias/dash/SortTable";
import { DashToolbar } from "@/components/yolias/dash/Toolbar";
import { periodOf } from "@/components/yolias/dash/period";
import { fmtValue } from "@/components/yolias/dash/format";

// Yolias Admin's dashboard (owner, 2026-11-03, D-276): every number that
// matters, for a period with filters, against the period before. Growth,
// revenue, customers, unit economics and the platform, then where they come
// from (channels, countries, devices) and how they stay (cohorts).
const CHANNELS = ["seo", "geo", "paid_ads", "social", "organic", "referral", "email", "affiliate", "unknown"] as const;
const CHANNEL_LABEL: Record<string, string> = { seo: "SEO", geo: "GEO / AEO", paid_ads: "إعلانات مدفوعة", social: "سوشيال ميديا", organic: "مباشر", referral: "إحالة من موقع", email: "بريد", affiliate: "شركاء", unknown: "غير معروف" };
const PLAN_LABEL: Record<string, string> = { growth: "النمو", scale: "التوسع", pro: "برو", free: "الدفع حسب الاستخدام" };

export default async function YoliasDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const sp = await searchParams;
  const period = periodOf(sp);
  const mode: Mode = sp.mode === "test" ? "test" : "live";
  const [d, locale] = await Promise.all([
    growthDashboard({ since: period.since, until: period.until, mode, country: sp.country ?? null, channel: sp.channel ?? null, device: sp.device ?? null, plan: sp.plan ?? null }),
    getLocale(),
  ]);
  const k = d.kpis;
  const region = new Intl.DisplayNames([locale], { type: "region" });
  const countryName = (c: string) => (c === "unknown" ? (locale === "ar" ? "غير معروف" : "Unknown") : (() => { try { return region.of(c) ?? c; } catch { return c; } })());
  const s = d.series;

  return (
    <div className="yd">
      <div className="yd-head">
        <h1><Tx>لوحة التحكم</Tx></h1>
        <DashToolbar
          preset={period.preset} from={period.from} to={period.to}
          filters={[
            { key: "mode", label: "حقيقي", options: [{ value: "test", label: "وضع الاختبار" }] },
            { key: "channel", label: "كل القنوات", options: CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] })) },
            { key: "country", label: "كل الدول", options: d.countries.filter((c) => c.key !== "unknown").map((c) => ({ value: c.key, label: countryName(c.key) })) },
            { key: "device", label: "كل الأجهزة", options: [{ value: "desktop", label: "كمبيوتر" }, { value: "mobile", label: "موبايل" }, { value: "tablet", label: "تابلت" }] },
            { key: "plan", label: "كل الخطط", options: ["growth", "scale", "pro"].map((p) => ({ value: p, label: PLAN_LABEL[p] })) },
          ]}
        />
      </div>

      <section className="yd-hero">
        <div>
          <div className="yd-hero-label"><Tx>الإيرادات</Tx></div>
          <div className="yd-hero-value" dir="ltr">{fmtValue(k.revenue.value, "usd")}</div>
          <Stat label="مقارنة بالفترة السابقة" value={k.revenue.prev} change={k.revenue.change} format="usd" tone="revenue" />
          <div className="yd-hero-sub">
            <div><span>MRR</span><strong dir="ltr">{fmtValue(k.mrr.value, "usd")}</strong></div>
            <div><span>ARR</span><strong dir="ltr">{fmtValue(k.arr.value, "usd")}</strong></div>
            <div><span><Tx>الأرباح</Tx></span><strong dir="ltr">{fmtValue(k.profit.value, "usd")}</strong></div>
          </div>
        </div>
        <LineChart labels={d.labels} lines={[{ name: "الإيرادات", values: s.revenue, tone: "red" }, { name: "تكلفة المنصة", values: s.cost, tone: "ink" }]} />
      </section>

      <Group title="النمو" tone="growth">
        <Stat tone="growth" label="الزوار" value={k.visitors.value} prev={k.visitors.prev} change={k.visitors.change} spark={s.visitors} href="/admin/platform/traffic" />
        <Stat tone="growth" label="الزيارات" value={k.visits.value} prev={k.visits.prev} change={k.visits.change} spark={s.visits} href="/admin/platform/traffic" />
        <Stat tone="growth" label="مشاهدات الصفحات" value={k.views.value} prev={k.views.prev} change={k.views.change} href="/admin/platform/traffic" />
        <Stat tone="growth" label="التسجيلات" value={k.signups.value} prev={k.signups.prev} change={k.signups.change} spark={s.signups} href="/admin/platform/users" />
        <Stat tone="growth" label="نسبة التسجيل" value={k.signupRate.value} prev={k.signupRate.prev} change={k.signupRate.change} format="pct" />
        <Stat tone="growth" label="نسبة التفعيل" value={k.activationRate.value} prev={k.activationRate.prev} change={k.activationRate.change} format="pct" />
        <Stat tone="growth" label="التحويل إلى الدفع" value={k.paidConversion.value} prev={k.paidConversion.prev} change={k.paidConversion.change} format="pct" />
      </Group>

      <Group title="الإيرادات" tone="revenue">
        <Stat tone="revenue" label="الإيرادات" value={k.revenue.value} prev={k.revenue.prev} change={k.revenue.change} format="usd" spark={s.revenue} href="/admin/platform/payments" />
        <Stat tone="revenue" label="MRR" value={k.mrr.value} prev={k.mrr.prev} change={k.mrr.change} format="usd" />
        <Stat tone="revenue" label="ARR" value={k.arr.value} prev={k.arr.prev} change={k.arr.change} format="usd" />
        <Stat tone="revenue" label="Run Rate" value={k.runRate.value} prev={k.runRate.prev} change={k.runRate.change} format="usd" />
        <Stat tone="revenue" label="ARPPU" value={k.arppu.value} prev={k.arppu.prev} change={k.arppu.change} format="usd" />
        <Stat tone="revenue" label="متوسط الإنفاق المتكرر" value={k.avgRecurring.value} prev={k.avgRecurring.prev} change={k.avgRecurring.change} format="usd" />
      </Group>

      <Group title="العملاء" tone="customers">
        <Stat tone="customers" label="عملاء جدد يدفعون" value={k.newPaying.value} prev={k.newPaying.prev} change={k.newPaying.change} spark={s.newPaying} />
        <Stat tone="customers" label="عملاء يدفعون الآن" value={k.activePaying.value} prev={k.activePaying.prev} change={k.activePaying.change} href="/admin/platform/users/subscribed" />
        <Stat tone="customers" label="المعلنون النشطون" value={k.activeAdvertisers.value} prev={k.activeAdvertisers.prev} change={k.activeAdvertisers.change} />
        <Stat tone="customers" label="نسبة الإلغاء" value={k.churnRate.value} prev={k.churnRate.prev} change={k.churnRate.change} format="pct" good="down" />
        <Stat tone="customers" label="تكرار الشراء" value={k.repeatRate.value} format="pct" />
        <Stat tone="customers" label="NRR" value={k.nrr.value} format="pct" />
      </Group>

      <Group title="اقتصاديات العميل" tone="economics">
        <Stat tone="economics" label="CAC" value={k.cac.value} prev={k.cac.prev} change={k.cac.change} format="usd" good="down" href="/admin/platform/finance" />
        <Stat tone="economics" label="LTV" value={k.ltv.value} prev={k.ltv.prev} change={k.ltv.change} format="usd" />
        <Stat tone="economics" label="LTV / CAC" value={k.ltvCac.value} prev={k.ltvCac.prev} change={k.ltvCac.change} format="x" />
        <Stat tone="economics" label="فترة الاسترداد (شهور)" value={k.payback.value} format="months" good="down" />
        <Stat tone="economics" label="الهامش الإجمالي" value={k.grossMargin.value} prev={k.grossMargin.prev} change={k.grossMargin.change} format="pct" />
        <Stat tone="economics" label="الأرباح" value={k.profit.value} prev={k.profit.prev} change={k.profit.change} format="usd" href="/admin/platform/finance" />
        <Stat tone="economics" label="نسبة الربح" value={k.profitMargin.value} prev={k.profitMargin.prev} change={k.profitMargin.change} format="pct" />
        <Stat tone="economics" label="تكلفة تقديم الخدمة" value={k.costToServe.value} prev={k.costToServe.prev} change={k.costToServe.change} format="usd" good="down" href="/admin/platform/costs" />
      </Group>

      <Group title="المنصة" tone="platform">
        <Stat tone="platform" label="الحملات المنشأة" value={k.campaigns.value} prev={k.campaigns.prev} change={k.campaigns.change} />
        <Stat tone="platform" label="الزيارات داخل المنصة" value={k.appSessions.value} prev={k.appSessions.prev} change={k.appSessions.change} href="/admin/platform/live" />
        <Stat tone="platform" label="مصاريف التسويق" value={k.marketing.value} prev={k.marketing.prev} change={k.marketing.change} format="usd" good="down" href="/admin/platform/finance" />
        <Stat tone="platform" label="التكاليف الثابتة" value={k.fixed.value} prev={k.fixed.prev} change={k.fixed.change} format="usd" good="down" href="/admin/platform/finance" />
      </Group>

      <div className="yd-grid2">
        <Panel title="الزوار والتسجيلات"><LineChart labels={d.labels} lines={[{ name: "الزوار", values: s.visitors, tone: "red" }, { name: "التسجيلات", values: s.signups, tone: "blue" }]} /></Panel>
        <Panel title="عملاء جدد مقابل الإلغاء"><BarChart labels={d.labels} lines={[{ name: "عملاء جدد يدفعون", values: s.newPaying, tone: "green" }, { name: "ألغوا", values: s.churned, tone: "red" }]} /></Panel>
      </div>

      <div className="yd-grid3">
        <Panel title="رحلة العميل">
          <Funnel steps={d.funnel.map((f) => ({ label: ({ visitors: "زاروا الموقع", signups: "سجّلوا", onboarded: "أكملوا الإعداد", activated: "أطلقوا حملة", paying: "دفعوا" } as Record<string, string>)[f.key], n: f.n }))} />
        </Panel>
        <Panel title="النمو والإلغاء">
          <div className="yd-kv">
            <div className="yd-kv-row head"><span /><span><Tx>يومي</Tx></span><span><Tx>شهري</Tx></span><span><Tx>سنوي</Tx></span></div>
            {([["التسجيلات", d.growth.signups], ["الإيرادات", d.growth.revenue], ["عملاء جدد يدفعون", d.growth.paying]] as const).map(([label, g]) => (
              <div className="yd-kv-row" key={label}><span><Tx>{label}</Tx></span>{[g.day, g.month, g.year].map((m, i) => <span key={i} dir="ltr" className={!m.change ? "" : m.change > 0 ? "yd-up" : "yd-down"}>{fmtValue(m.change, "pct")}</span>)}</div>
            ))}
            <div className="yd-kv-row"><span><Tx>نسبة الإلغاء</Tx></span>{[d.churn.day, d.churn.month, d.churn.year].map((v, i) => <span key={i} dir="ltr">{fmtValue(v, "pct")}</span>)}</div>
          </div>
        </Panel>
        <Panel title="المشتركون">
          {(() => { const t = d.subscribers.monthly + d.subscribers.annual + d.subscribers.payg; const w = (n: number) => `${t ? (n / t) * 100 : 0}%`; return (
            <>
              <div className="yd-split" aria-hidden="true"><span style={{ width: w(d.subscribers.monthly) }} /><span style={{ width: w(d.subscribers.annual) }} /><span style={{ width: w(d.subscribers.payg) }} /></div>
              <div className="yd-split-legend">
                <div><span><i /><Tx>شهري</Tx></span><strong dir="ltr">{fmtValue(d.subscribers.monthly, "num")}</strong><span dir="ltr">{t ? fmtValue(d.subscribers.monthly / t, "pct") : "—"}</span></div>
                <div><span><i /><Tx>سنوي</Tx></span><strong dir="ltr">{fmtValue(d.subscribers.annual, "num")}</strong><span dir="ltr">{t ? fmtValue(d.subscribers.annual / t, "pct") : "—"}</span></div>
                <div><span><i /><Tx>حسب الاستخدام</Tx></span><strong dir="ltr">{fmtValue(d.subscribers.payg, "num")}</strong><span dir="ltr">{t ? fmtValue(d.subscribers.payg / t, "pct") : "—"}</span></div>
              </div>
            </>
          ); })()}
        </Panel>
      </div>

      <Panel title="القنوات">
        <SortTable
          firstLabel="القناة" initial="visitors"
          cols={[{ key: "visitors", label: "الزوار", bar: true }, { key: "signups", label: "التسجيلات", bar: true }, { key: "rate", label: "نسبة التسجيل", format: "pct" }, { key: "paying", label: "عملاء يدفعون" }, { key: "conv", label: "التحويل إلى الدفع", format: "pct" }, { key: "revenue", label: "الإيرادات", format: "usd", bar: true }]}
          rows={d.channels.map((c) => ({ id: c.key, label: <Tx>{CHANNEL_LABEL[c.key] ?? c.key}</Tx>, sortLabel: c.key, values: { visitors: c.visitors, signups: c.signups, rate: c.visitors ? c.signups / c.visitors : null, paying: c.paying, conv: c.signups ? c.paying / c.signups : null, revenue: c.revenue } }))}
        />
      </Panel>

      <div className="yd-grid2">
        <Panel title="الدول">
          <GeoMap values={Object.fromEntries(d.countries.filter((c) => c.key !== "unknown").map((c) => [c.key, c.visitors]))} label={(c, v) => `${countryName(c)}: ${v}`} />
          <SortTable
            firstLabel="الدولة" initial="visitors" limit={8}
            cols={[{ key: "visitors", label: "الزوار", bar: true }, { key: "signups", label: "التسجيلات" }, { key: "paying", label: "عملاء يدفعون" }, { key: "revenue", label: "الإيرادات", format: "usd" }]}
            rows={d.countries.map((c) => ({ id: c.key, label: countryName(c.key), sortLabel: countryName(c.key), values: { visitors: c.visitors, signups: c.signups, paying: c.paying, revenue: c.revenue } }))}
          />
        </Panel>
        <div className="yd-grid-stack">
          <Panel title="الأجهزة">
            <SortTable firstLabel="الجهاز" cols={[{ key: "visitors", label: "الزوار", bar: true }]} rows={d.devices.map((r) => ({ id: r.key, label: <Tx>{({ desktop: "كمبيوتر", mobile: "موبايل", tablet: "تابلت", unknown: "غير معروف" } as Record<string, string>)[r.key] ?? r.key}</Tx>, sortLabel: r.key, values: { visitors: r.visitors } }))} />
          </Panel>
          <Panel title="المتصفحات">
            <SortTable firstLabel="المتصفح" cols={[{ key: "visitors", label: "الزوار", bar: true }]} rows={d.browsers.map((r) => ({ id: r.key, label: r.key, sortLabel: r.key, values: { visitors: r.visitors } }))} />
          </Panel>
        </div>
      </div>

      <div className="yd-grid2">
        <Panel title="الخطط">
          <SortTable firstLabel="الخطة" initial="mrr"
            cols={[{ key: "subscribers", label: "المشتركون", bar: true }, { key: "mrr", label: "MRR", format: "usd", bar: true }]}
            rows={d.plans.map((p) => ({ id: `${p.plan}-${p.period}`, label: <><Tx>{PLAN_LABEL[p.plan] ?? p.plan}</Tx> · <Tx>{p.period === "annual" ? "سنوي" : "شهري"}</Tx></>, sortLabel: p.plan, values: { subscribers: p.subscribers, mrr: p.mrr } }))} />
        </Panel>
        <Panel title="أكبر العملاء" actions={d.concentration.topShare != null ? <span className="yd-prev"><Tx vars={{ p: fmtValue(d.concentration.topShare, "pct") }}>{"أعلى 10% = {p} من الإيرادات"}</Tx></span> : undefined}>
          <SortTable firstLabel="العميل" initial="revenue"
            cols={[{ key: "revenue", label: "الإيرادات", format: "usd", bar: true }, { key: "share", label: "النسبة", format: "pct" }]}
            rows={d.topCustomers.map((c) => ({ id: c.workspaceId, label: <Link href={`/admin/platform/workspaces/${c.workspaceId}`}>{c.name ?? c.workspaceId.slice(0, 8)}</Link>, sortLabel: c.name ?? "", values: { revenue: c.revenue, share: k.revenue.value ? c.revenue / k.revenue.value : null } }))} />
        </Panel>
      </div>

      <Panel title="الاحتفاظ بالعملاء (حسب شهر أول دفعة)">
        <div className="yd-table-wrap">
          <table className="yd-table yd-cohort">
            <thead><tr><th><Tx>الشهر</Tx></th><th><Tx>العملاء</Tx></th>{[0, 1, 2, 3, 4, 5].map((m) => <th key={m}><Tx vars={{ m }}>{"شهر {m}"}</Tx></th>)}</tr></thead>
            <tbody>
              {d.cohorts.map((c) => (
                <tr key={c.month}><th scope="row" dir="ltr">{c.month}</th><td dir="ltr">{c.size}</td>{c.retained.map((r, i) => <td key={i} className="c" data-l={r == null ? "" : Math.min(4, Math.ceil(r * 4))} dir="ltr">{r == null ? "" : fmtValue(r, "pct")}</td>)}</tr>
              ))}
              {!d.cohorts.length && <tr><td colSpan={8} className="yd-empty"><Tx>لا توجد بيانات في هذه الفترة</Tx></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
