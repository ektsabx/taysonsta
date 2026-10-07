import type { Metadata } from "next";
import { RangePicker } from "@/components/app/RangePicker";
import { countryLabel, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { discoveryAnalytics, parseRange, ranges } from "@/services/analytics";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.analytics} — Yolias` };
}

type BarRow = { key: string; pct: number; count: number };

// One bar style for every list (Yolias design: ink on a quiet track, no palette).
function Bars({ rows, label, value, empty }: { rows: BarRow[]; label: (k: string) => string; value: (r: BarRow) => string; empty: string }) {
  if (!rows.length) return <p className="panel-empty">{empty}</p>;
  return (
    <div className="an-bars">
      {rows.map((m) => (
        <div key={m.key} className="an-bar-row">
          <div className="an-bar-head"><span dir="auto">{label(m.key)}</span><span className="an-bar-value">{value(m)}</span></div>
          <div className="an-track"><div className="an-fill" style={{ width: `${Math.max(m.pct, 2)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`panel-card${wide ? " panel-wide" : ""}`}>
      <h4 className="panel-title">{title}</h4>
      {children}
    </section>
  );
}

// Discovery analytics (D-162): totals against the previous period, the
// trend, the results pipeline, data quality, ICP performance, distribution,
// decision makers, top markets and user activity — one visual style (D-166).
export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const session = await requireSession();
  const range = parseRange((await searchParams).range);
  const a = await discoveryAnalytics(session.workspace.id, range);
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const an = t.analytics;
  const csv = t.prospects.csv as unknown as Record<string, string>;
  const n = (v: number) => formatNumber(v, locale);
  const p = (v: number | null) => (v == null ? "—" : `${v}%`);
  const changeNote = (v: number | null) => (v == null ? an.noPrevious : fmt(an.vsPrevious, { change: `${v > 0 ? "+" : ""}${v}%` }));
  const country = (k: string) => countryLabel(k, locale);
  const same = (k: string) => k;
  const share = (r: BarRow) => `${n(r.count)} (${r.pct}%)`;
  const fieldLabel = (f: string) => csv[{ full_name: "name", linkedin_url: "linkedin", employee_count: "employees", reviews_count: "reviews", maps_url: "mapsUrl", website: "domain", facebook_url: "facebook", instagram_url: "instagram" }[f] ?? f] ?? f;
  const tr = a.trend;
  const peak = Math.max(1, ...tr.buckets.map((b) => b.leads));
  const scored = a.icp.scored;
  const ofScored = (v: number) => (scored ? Math.round((v / scored) * 100) : 0);
  const funnel = (["discovered", "qualified", "selected", "contacted"] as const).map((k) => ({ key: k, value: a.funnel[k] }));
  const distributions = [
    { k: "country" as const, rows: a.distribution.country, label: country },
    { k: "industry" as const, rows: a.distribution.industry, label: same },
    { k: "size" as const, rows: a.distribution.size, label: same },
    { k: "city" as const, rows: a.distribution.city, label: same },
  ];

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{an.title}</h2>
          <p>{an.subtitle}</p>
        </div>
        <div className="view-actions">
          <RangePicker value={range} options={(Object.keys(ranges) as (keyof typeof ranges)[]).map((k) => ({ key: k, label: an.ranges[k] }))} />
        </div>
      </header>

      <div className="view-content-padding analytics-page">
        <div className="stat-grid">
          {([
            [an.companiesDiscovered, n(a.totals.companies), changeNote(a.totals.vsPrevious.companies)],
            [an.decisionMakers, n(a.totals.decisionMakers), changeNote(a.totals.vsPrevious.decisionMakers)],
            [an.avgMatch, p(a.icp.avgMatch), fmt(an.strongShare, { pct: ofScored(a.icp.strong) })],
            [csv.email, n(a.dataQuality.emailFound), fmt(an.quality.ofLeads, { pct: a.totals.leads ? Math.round((a.dataQuality.emailFound / a.totals.leads) * 100) : 0 })],
          ] as const).map(([label, value, note]) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
              <div className="stat-note">{note}</div>
            </div>
          ))}
        </div>

        <div className="analytics-grid">
          <Panel title={an.sections.trend} wide>
            <p className="cell-sub an-caption">{tr.step === "week" ? an.trendWeek : an.trendDay}</p>
            {a.totals.leads === 0 ? <p className="panel-empty">{an.empty}</p> : (
              <div className="an-trend" role="img" aria-label={an.sections.trend}>
                {tr.buckets.map((b) => (
                  <div key={b.start} className="an-trend-col" title={`${b.start} · ${n(b.leads)}`}>
                    <span className="an-trend-bar" style={{ height: `${(b.leads / peak) * 100}%` }} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={an.sections.funnel}>
            <Bars rows={funnel.map((f) => ({ key: f.key, count: f.value ?? 0, pct: a.funnel.discovered ? Math.round(((f.value ?? 0) / a.funnel.discovered) * 100) : 0 }))}
              label={(k) => an.funnel[k as (typeof funnel)[number]["key"]]} value={(r) => n(r.count)} empty={an.empty} />
          </Panel>

          <Panel title={an.sections.icp}>
            {scored === 0 ? <p className="panel-empty">{an.icp.none}</p> : (
              <Bars rows={[
                { key: "strong", count: a.icp.strong, pct: ofScored(a.icp.strong) },
                { key: "good", count: a.icp.good, pct: ofScored(a.icp.good) },
                { key: "weak", count: a.icp.weak, pct: ofScored(a.icp.weak) },
              ]} label={(k) => an.icp[k as "strong" | "good" | "weak"]} value={share} empty={an.icp.none} />
            )}
          </Panel>

          <Panel title={an.sections.quality}>
            <Bars rows={a.dataQuality.missing.map((m) => ({ key: m.field, pct: m.pct, count: m.count }))} label={fieldLabel} value={(r) => fmt(an.quality.missingCount, { count: n(r.count), pct: r.pct })} empty={an.quality.noMissing} />
          </Panel>

          <Panel title={an.sections.markets}>
            {a.markets.length === 0 ? <p className="panel-empty">{an.marketEmpty}</p> : (
              <div className="data-table-scroll">
                <table className="data-table compact">
                  <thead><tr><th>{an.marketCols.market}</th><th>{an.marketCols.leads}</th><th>{an.marketCols.match}</th></tr></thead>
                  <tbody>
                    {a.markets.map((m) => (
                      <tr key={m.country}><td>{country(m.country)}</td><td>{n(m.leads)}</td><td>{p(m.avgMatch)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title={an.sections.distribution} wide>
            <div className="dist-grid">
              {distributions.map((d) => (
                <div key={d.k}>
                  <h5 className="panel-subtitle">{an.dist[d.k]}</h5>
                  <Bars rows={d.rows} label={d.label} value={share} empty={an.dist.none} />
                </div>
              ))}
            </div>
          </Panel>

          {a.decisionMakers.total > 0 && (
            <Panel title={an.sections.decisionMakers} wide>
              <Bars rows={a.decisionMakers.roles.filter((r) => r.count > 0)} label={(k) => an.roles[k as keyof typeof an.roles]} value={share} empty={an.dist.none} />
            </Panel>
          )}

          <Panel title={an.sections.activity} wide>
            <dl className="an-activity">
              {(["searches", "qualifications", "emailsPrepared", "exports"] as const).map((k) => (
                <div key={k}><dt>{an.activity[k]}</dt><dd>{n(a.activity[k])}</dd></div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
