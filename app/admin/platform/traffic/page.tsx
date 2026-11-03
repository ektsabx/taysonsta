import { requirePermission } from "@/lib/bos/auth";
import { getLocale } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { trafficBreakdowns, type TrafficDim } from "@/services/yolias/traffic";
import { Group, Panel, Stat } from "@/components/yolias/dash/Stat";
import { LineChart } from "@/components/yolias/dash/Charts";
import { GeoMap } from "@/components/yolias/dash/GeoMap";
import { SortTable } from "@/components/yolias/dash/SortTable";
import { DashToolbar } from "@/components/yolias/dash/Toolbar";
import { periodOf } from "@/components/yolias/dash/period";
import { bucketOf, buckets, change } from "@/lib/yolias/growth-math";

// Visitors and channels (owner, 2026-11-03, D-276): page views on yolias.com
// (or in the app) by channel, search engine and AI assistant, entry page,
// referrer, campaign, country, city, device, system and browser.
const CHANNEL: Record<string, string> = { organic_search: "SEO", ai_assistant: "GEO / AEO", paid_search: "إعلانات مدفوعة", social: "سوشيال ميديا", direct: "مباشر", referral: "إحالة من موقع", email: "بريد", affiliate: "شركاء", unknown: "غير معروف" };
const DEVICE: Record<string, string> = { desktop: "كمبيوتر", mobile: "موبايل", tablet: "تابلت", unknown: "غير معروف" };
const DIMS: TrafficDim[] = ["channel", "engine", "landing", "path", "referrer_host", "utm_campaign", "country", "city", "device", "os", "browser"];
const cols = [{ key: "visitors", label: "الزوار", bar: true }, { key: "visits", label: "الزيارات" }, { key: "views", label: "المشاهدات" }];

export default async function TrafficPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const sp = await searchParams;
  const p = periodOf(sp);
  const area = sp.area === "app" ? "app" : sp.area === "all" ? null : "site";
  const [t, locale] = await Promise.all([trafficBreakdowns(p.since, p.until, area, DIMS), getLocale()]);
  const region = new Intl.DisplayNames([locale], { type: "region" });
  const country = (c: string) => (c === "unknown" ? (locale === "ar" ? "غير معروف" : "Unknown") : (() => { try { return region.of(c) ?? c; } catch { return c; } })());
  const rows = (dim: TrafficDim, label: (k: string) => React.ReactNode = (k) => k) => t.by[dim].map((r) => ({ id: r.key, label: label(r.key), sortLabel: r.key, values: { visitors: r.visitors, visits: r.visits, views: r.views } }));
  const n = t.now, pr = t.prev;
  // Every day (or week, month) of the period, with 0 where nothing was counted.
  const { unit, starts } = buckets(Date.parse(p.since), Date.parse(p.until));
  const series = (k: "visitors" | "views" | "visits") => { const out = starts.map(() => 0); for (const d of t.daily) { const i = bucketOf(starts, Date.parse(`${d.day}T00:00:00Z`), Date.parse(p.until)); if (i >= 0) out[i] += d[k]; } return out; };
  const labels = starts.map((x) => new Date(x).toISOString().slice(0, unit === "month" ? 7 : 10));
  return (
    <div className="yd">
      <div className="yd-head">
        <h1><Tx>الزوار والقنوات</Tx></h1>
        <DashToolbar preset={p.preset} from={p.from} to={p.to} filters={[{ key: "area", label: "الموقع", options: [{ value: "app", label: "داخل المنصة" }, { value: "all", label: "الموقع والمنصة" }] }]} />
      </div>
      <Group title="الزيارات" tone="growth">
        <Stat tone="growth" label="الزوار" value={n.visitors} prev={pr.visitors} change={change(n.visitors, pr.visitors)} spark={series("visitors")} />
        <Stat tone="growth" label="الزيارات" value={n.visits} prev={pr.visits} change={change(n.visits, pr.visits)} spark={series("visits")} />
        <Stat tone="growth" label="مشاهدات الصفحات" value={n.views} prev={pr.views} change={change(n.views, pr.views)} spark={series("views")} />
        <Stat tone="growth" label="صفحات لكل زيارة" value={n.visits ? n.views / n.visits : null} prev={pr.visits ? pr.views / pr.visits : null} />
      </Group>
      <Panel title="الزوار يوميًا"><LineChart labels={labels} lines={[{ name: "الزوار", values: series("visitors"), tone: "red" }, { name: "المشاهدات", values: series("views"), tone: "ink" }]} /></Panel>
      <div className="yd-grid2">
        <Panel title="القنوات"><SortTable firstLabel="القناة" initial="visitors" cols={cols} rows={rows("channel", (k) => <Tx>{CHANNEL[k] ?? k}</Tx>)} /></Panel>
        <Panel title="محركات البحث والمساعدات الذكية"><SortTable firstLabel="المصدر" initial="visitors" cols={cols} rows={rows("engine")} /></Panel>
        <Panel title="صفحات الدخول"><SortTable firstLabel="الصفحة" initial="visitors" cols={cols} rows={rows("landing", (k) => <span dir="ltr">{k}</span>)} /></Panel>
        <Panel title="أكثر الصفحات مشاهدة"><SortTable firstLabel="الصفحة" initial="views" cols={cols} rows={rows("path", (k) => <span dir="ltr">{k}</span>)} /></Panel>
        <Panel title="المواقع المحيلة"><SortTable firstLabel="الموقع" initial="visitors" cols={cols} rows={rows("referrer_host", (k) => <span dir="ltr">{k}</span>)} /></Panel>
        <Panel title="الحملات (UTM)"><SortTable firstLabel="الحملة" initial="visitors" cols={cols} rows={rows("utm_campaign")} /></Panel>
      </div>
      <div className="yd-grid2">
        <Panel title="الدول">
          <GeoMap values={Object.fromEntries(t.by.country.filter((r) => r.key !== "unknown").map((r) => [r.key, r.visitors]))} label={(c, v) => `${country(c)}: ${v}`} />
          <SortTable firstLabel="الدولة" initial="visitors" limit={8} cols={cols} rows={rows("country", country)} />
        </Panel>
        <Panel title="المدن"><SortTable firstLabel="المدينة" initial="visitors" cols={cols} rows={rows("city")} /></Panel>
      </div>
      <div className="yd-grid3">
        <Panel title="الأجهزة"><SortTable firstLabel="الجهاز" initial="visitors" cols={cols.slice(0, 1)} rows={rows("device", (k) => <Tx>{DEVICE[k] ?? k}</Tx>)} /></Panel>
        <Panel title="أنظمة التشغيل"><SortTable firstLabel="النظام" initial="visitors" cols={cols.slice(0, 1)} rows={rows("os")} /></Panel>
        <Panel title="المتصفحات"><SortTable firstLabel="المتصفح" initial="visitors" cols={cols.slice(0, 1)} rows={rows("browser")} /></Panel>
      </div>
    </div>
  );
}
