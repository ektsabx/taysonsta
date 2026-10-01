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

// Bar colors cycle through the design's market palette (ink, blue, red).
const palette = [
  { fill: "var(--ink)", track: "var(--table-head)", text: "var(--ink)" },
  { fill: "var(--blue)", track: "var(--blue-soft)", text: "var(--blue)" },
  { fill: "var(--red)", track: "var(--red-soft)", text: "var(--red)" },
];

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const session = await requireSession();
  const range = parseRange((await searchParams).range);
  const a = await discoveryAnalytics(session.workspace.id, range);
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const an = t.analytics;
  const n = (v: number) => formatNumber(v, locale);

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

      <div className="view-content-padding">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">{an.prospectsFound}</div>
            <div className="stat-value">{n(a.prospects)}</div>
            <div className={`stat-note${a.prospects ? " good" : ""}`}>{a.prospects ? fmt(an.verifiedContacts, { pct: a.verifiedPct }) : an.noProspects}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{an.companiesDiscovered}</div>
            <div className="stat-value">{n(a.companies)}</div>
            <div className="stat-note">{an.companiesNote}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{an.decisionMakers}</div>
            <div className="stat-value">{n(a.decisionMakers)}</div>
            <div className="stat-note good">{an.decisionMakersNote}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{an.fitRate}</div>
            <div className="stat-value">{a.fitRate == null ? "—" : `${a.fitRate}%`}</div>
            <div className="stat-note">{an.fitRateNote}</div>
          </div>
        </div>

        <div className="panel-card">
          <h4 className="panel-title">{an.byMarket}</h4>
          {a.markets.length === 0 ? (
            <p className="panel-empty">{an.marketEmpty}</p>
          ) : (
            <div className="market-list">
              {a.markets.map((m, i) => {
                const c = palette[i % palette.length];
                return (
                  <div key={m.country}>
                    <div className="market-row-head">
                      <span>{countryLabel(m.country, locale)}</span>
                      <span style={{ color: c.text }}>{fmt(an.marketCount, { count: n(m.count), pct: m.pct })}</span>
                    </div>
                    <div className="market-track" style={{ background: c.track }}>
                      <div className="market-fill" style={{ width: `${m.pct}%`, background: c.fill }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
