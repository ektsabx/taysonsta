import type { Metadata } from "next";
import { RangePicker } from "@/components/app/RangePicker";
import { countryLabel, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import type { MatchGroup } from "@/lib/analytics/discovery";
import { discoveryAnalytics, parseRange, ranges } from "@/services/analytics";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.analytics} — Yolias` };
}

// Bar colors cycle through the design's market palette (ink, blue, red).
const palette = [
  { fill: "var(--ink)", track: "var(--table-head)", text: "var(--ink)" },
  { fill: "var(--blue)", track: "var(--blue-soft)", text: "var(--blue)" },
  { fill: "var(--red)", track: "var(--red-soft)", text: "var(--red)" },
];

type BarRow = { key: string; pct: number; count: number };

function Bars({ rows, label, value, empty }: { rows: BarRow[]; label: (k: string) => string; value: (r: BarRow) => string; empty: string }) {
  if (!rows.length) return <p className="panel-empty">{empty}</p>;
  return (
    <div className="market-list">
      {rows.map((m, i) => {
        const c = palette[i % palette.length];
        return (
          <div key={m.key}>
            <div className="market-row-head">
              <span dir="auto">{label(m.key)}</span>
              <span style={{ color: c.text }}>{value(m)}</span>
            </div>
            <div className="market-track" style={{ background: c.track }}>
              <div className="market-fill" style={{ width: `${Math.max(m.pct, 2)}%`, background: c.fill }} />
            </div>
          </div>
        );
      })}
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
// decision makers, sources, top markets and user activity.
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
  const matchRows = (rows: MatchGroup[]): BarRow[] => rows.map((g) => ({ key: g.key, pct: g.avgMatch ?? 0, count: g.count }));
  const matchValue = (r: BarRow) => `${fmt(an.icp.avg, { pct: r.pct })} · ${n(r.count)}`;
  const fieldLabel = (f: string) => csv[{ full_name: "name", linkedin_url: "linkedin", employee_count: "employees", reviews_count: "reviews", maps_url: "mapsUrl", website: "domain", facebook_url: "facebook", instagram_url: "instagram" }[f] ?? f] ?? f;
  const tr = a.trend;
  const peak = Math.max(1, ...tr.buckets.map((b) => b.leads));
  const scored = a.icp.scored;
  const ofScored = (v: number) => (scored ? Math.round((v / scored) * 100) : 0);
  const funnel = (["discovered", "qualified", "selected", "contacted", "engaged", "converted"] as const).map((k) => ({ key: k, value: a.funnel[k] }));
  const funnelNote = (k: (typeof funnel)[number]["key"], v: number | null) =>
    k === "qualified" ? an.funnelNotes.qualified : k === "selected" ? an.funnelNotes.selected : k === "contacted" ? an.funnelNotes.contacted : v == null ? an.funnelNotes.notTracked : "";
  const distributions = [
    { k: "country" as const, rows: a.distribution.country, label: country },
    { k: "industry" as const, rows: a.distribution.industry, label: same },
    { k: "size" as const, rows: a.distribution.size, label: same },
    { k: "city" as const, rows: a.distribution.city, label: same },
    { k: "title" as const, rows: a.distribution.title, label: same },
    { k: "seniority" as const, rows: a.distribution.seniority, label: (k: string) => an.seniority[k as keyof typeof an.seniority] ?? k },
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
            [an.leads, a.totals.leads, a.totals.vsPrevious.leads],
            [an.companiesDiscovered, a.totals.companies, a.totals.vsPrevious.companies],
            [an.decisionMakers, a.totals.decisionMakers, a.totals.vsPrevious.decisionMakers],
          ] as const).map(([label, value, change]) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{n(value)}</div>
              <div className={`stat-note${(change ?? 0) > 0 ? " good" : ""}`}>{changeNote(change)}</div>
            </div>
          ))}
          <div className="stat-card">
            <div className="stat-label">{an.avgMatch}</div>
            <div className="stat-value">{p(a.icp.avgMatch)}</div>
            <div className="stat-note good">{fmt(an.strongShare, { pct: ofScored(a.icp.strong) })}</div>
          </div>
        </div>

        <div className="analytics-grid">
          <Panel title={an.sections.trend} wide>
            <div className="trend-legend">
              <span className="cell-sub">{tr.step === "week" ? an.trendWeek : an.trendDay}</span>
              <span><i className="dot ink" /> {an.trendLegend.leads}</span>
              <span><i className="dot blue" /> {an.trendLegend.companies}</span>
              <span><i className="dot red" /> {an.trendLegend.decisionMakers}</span>
            </div>
            {a.totals.leads === 0 ? <p className="panel-empty">{an.empty}</p> : (
              <div className="trend-chart" role="img" aria-label={an.sections.trend}>
                {tr.buckets.map((b) => (
                  <div key={b.start} className="trend-col" title={`${b.start} · ${an.trendLegend.leads} ${n(b.leads)} · ${an.trendLegend.companies} ${n(b.companies)} · ${an.trendLegend.decisionMakers} ${n(b.decisionMakers)}`}>
                    <span className="trend-bar ink" style={{ height: `${(b.leads / peak) * 100}%` }} />
                    <span className="trend-bar blue" style={{ height: `${(b.companies / peak) * 100}%` }} />
                    <span className="trend-bar red" style={{ height: `${(b.decisionMakers / peak) * 100}%` }} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={an.sections.funnel} wide>
            <ol className="funnel">
              {funnel.map((f) => (
                <li key={f.key}>
                  <span className="funnel-label">{an.funnel[f.key]}</span>
                  <strong className="funnel-value">{f.value == null ? "—" : n(f.value)}</strong>
                  <div className="market-track" style={{ background: "var(--red-soft)" }}>
                    <div className="market-fill" style={{ width: `${f.value == null || !a.funnel.discovered ? 0 : Math.max((f.value / a.funnel.discovered) * 100, 2)}%`, background: "var(--red)" }} />
                  </div>
                  <span className="cell-sub">{funnelNote(f.key, f.value)}</span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title={an.sections.quality}>
            <dl className="metric-tiles">
              <div><dt>{an.quality.verifiedContacts}</dt><dd>{n(a.dataQuality.verifiedContacts)}</dd><span className="cell-sub">{fmt(an.quality.ofLeads, { pct: a.dataQuality.verifiedContactsPct })}</span></div>
              <div><dt>{an.quality.emailVerified}</dt><dd>{n(a.dataQuality.emailVerified)}</dd><span className="cell-sub">{fmt(an.quality.emailsFound, { count: n(a.dataQuality.emailFound) })}</span></div>
              <div><dt>{an.quality.phoneVerified}</dt><dd>—</dd><span className="cell-sub">{fmt(an.quality.phonesFound, { count: n(a.dataQuality.phoneFound) })}</span></div>
            </dl>
            <h5 className="panel-subtitle">{an.quality.missing}</h5>
            <Bars rows={a.dataQuality.missing.map((m) => ({ key: m.field, pct: m.pct, count: m.count }))} label={fieldLabel} value={(r) => fmt(an.quality.missingCount, { count: n(r.count), pct: r.pct })} empty={an.quality.noMissing} />
          </Panel>

          <Panel title={an.sections.icp}>
            {scored === 0 ? <p className="panel-empty">{an.icp.none}</p> : (
              <>
                <div className="icp-split" aria-hidden="true">
                  <span className="strong" style={{ flexGrow: a.icp.strong }} />
                  <span className="good" style={{ flexGrow: a.icp.good }} />
                  <span className="weak" style={{ flexGrow: a.icp.weak }} />
                </div>
                <dl className="icp-legend">
                  <div><dt><i className="dot strong" /> {an.icp.strong}</dt><dd>{n(a.icp.strong)} ({ofScored(a.icp.strong)}%)</dd></div>
                  <div><dt><i className="dot good" /> {an.icp.good}</dt><dd>{n(a.icp.good)} ({ofScored(a.icp.good)}%)</dd></div>
                  <div><dt><i className="dot weak" /> {an.icp.weak}</dt><dd>{n(a.icp.weak)} ({ofScored(a.icp.weak)}%)</dd></div>
                </dl>
                <h5 className="panel-subtitle">{an.icp.byMarket}</h5>
                <Bars rows={matchRows(a.icp.byMarket)} label={country} value={matchValue} empty={an.dist.none} />
                <h5 className="panel-subtitle">{an.icp.byIndustry}</h5>
                <Bars rows={matchRows(a.icp.byIndustry)} label={same} value={matchValue} empty={an.dist.none} />
                <h5 className="panel-subtitle">{an.icp.bySize}</h5>
                <Bars rows={matchRows(a.icp.bySize)} label={same} value={matchValue} empty={an.dist.none} />
              </>
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

          <Panel title={an.sections.decisionMakers}>
            <dl className="metric-tiles single">
              <div><dt>{an.perCompany}</dt><dd>{a.decisionMakers.perCompany ?? "—"}</dd></div>
            </dl>
            <Bars rows={a.decisionMakers.total ? a.decisionMakers.roles : []} label={(k) => an.roles[k as keyof typeof an.roles]} value={share} empty={an.dist.none} />
          </Panel>

          <Panel title={an.sections.markets} wide>
            {a.markets.length === 0 ? <p className="panel-empty">{an.marketEmpty}</p> : (
              <>
                <div className="data-table-scroll">
                  <table className="data-table compact">
                    <thead><tr><th>{an.marketCols.market}</th><th>{an.marketCols.leads}</th><th>{an.marketCols.match}</th><th>{an.marketCols.verified}</th><th>{an.marketCols.quality}</th></tr></thead>
                    <tbody>
                      {a.markets.map((m) => (
                        <tr key={m.country}>
                          <td>{country(m.country)}</td><td>{n(m.leads)}</td><td>{p(m.avgMatch)}</td><td>{n(m.verified)}</td>
                          <td><span className={`quality-pill${m.quality >= 70 ? " good" : m.quality >= 50 ? " mid" : ""}`}>{m.quality}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="cell-sub panel-foot">{an.qualityNote}</p>
              </>
            )}
          </Panel>

          <Panel title={an.sections.activity} wide>
            <dl className="metric-tiles six">
              {(["searches", "enrichments", "qualifications", "exports", "emailsPrepared", "csvExports"] as const).map((k) => (
                <div key={k}><dt>{an.activity[k]}</dt><dd>{n(a.activity[k])}</dd></div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
