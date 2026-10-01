import type { Metadata } from "next";
import { RangePicker } from "@/components/app/RangePicker";
import { countryName } from "@/lib/discovery/icp";
import { formatNumber } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { discoveryAnalytics, parseRange, rangeLabels, ranges } from "@/services/analytics";

export const metadata: Metadata = { title: "Analytics — Yolias" };

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

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>Discovery Analytics</h2>
          <p>Customer acquisition volume, verified companies, and ICP precision metrics</p>
        </div>
        <div className="view-actions">
          <RangePicker value={range} options={(Object.keys(ranges) as (keyof typeof ranges)[]).map((k) => ({ key: k, label: rangeLabels[k] }))} />
        </div>
      </header>

      <div className="view-content-padding">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Prospects Found</div>
            <div className="stat-value">{formatNumber(a.prospects)}</div>
            <div className={`stat-note${a.prospects ? " good" : ""}`}>{a.prospects ? `${a.verifiedPct}% verified contacts` : "No prospects yet"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Companies Discovered</div>
            <div className="stat-value">{formatNumber(a.companies)}</div>
            <div className="stat-note">Target accounts matching ICP</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Decision Makers Extracted</div>
            <div className="stat-value">{formatNumber(a.decisionMakers)}</div>
            <div className="stat-note good">CEOs, Founders, VPs</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Qualified Fit Rate</div>
            <div className="stat-value">{a.fitRate == null ? "—" : `${a.fitRate}%`}</div>
            <div className="stat-note">Passed strict ICP filters</div>
          </div>
        </div>

        <div className="panel-card">
          <h4 className="panel-title">Discovery Volume by Market</h4>
          {a.markets.length === 0 ? (
            <p className="panel-empty">Market breakdown appears once Yolias has discovered prospects in this period.</p>
          ) : (
            <div className="market-list">
              {a.markets.map((m, i) => {
                const c = palette[i % palette.length];
                return (
                  <div key={m.country}>
                    <div className="market-row-head">
                      <span>{countryName(m.country)}</span>
                      <span style={{ color: c.text }}>{formatNumber(m.count)} Prospects ({m.pct}%)</span>
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
