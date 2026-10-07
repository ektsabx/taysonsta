import { formatDate } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n/config";
import type { FieldProvenance, Json } from "@/types/database";

// The standard intelligence fields of any result (final spec §37): match and
// why, confidence, last updated, what's missing, and where each field came from.
export function IntelligencePanel({ t, locale, timeZone, row }: {
  t: Dictionary; locale: Locale; timeZone: string;
  row: { match_score: number | null; match_reasons: Json; confidence: number | null; provenance: Json; missing_fields: string[]; last_updated: string; source: string };
}) {
  const d = t.prospects.detail;
  const csv = t.prospects.csv as unknown as Record<string, string>;
  const names: Record<string, string> = { ...csv, description: d.about, funding_stage: csv.funding, hiring_roles: csv.hiringRoles };
  const label = (f: string) => names[{ full_name: "name", linkedin_url: "linkedin", employee_count: "employees", reviews_count: "reviews", maps_url: "mapsUrl", posted_at: "postedAt", website: "domain", facebook_url: "facebook", instagram_url: "instagram" }[f] ?? f] ?? f;
  const reasons = Array.isArray(row.match_reasons) ? (row.match_reasons as string[]) : [];
  const prov = (Array.isArray(row.provenance) ? row.provenance : []) as unknown as FieldProvenance[];
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  return (
    <section className="detail-card">
      <h3>{d.intelligence}</h3>
      <dl className="detail-grid">
        <dt>{d.match}</dt><dd>{row.match_score != null ? `${row.match_score}%` : "—"}{reasons.length > 0 && <span className="cell-sub">{d.reasons}: {reasons.join(" · ")}</span>}</dd>
        <dt>{d.confidence}</dt><dd>{pct(row.confidence)}</dd>
        <dt>{d.lastUpdated}</dt><dd>{formatDate(row.last_updated, locale, timeZone)}</dd>
        <dt>{t.prospects.csv.source}</dt><dd dir="ltr">{row.source}</dd>
        <dt>{d.missing}</dt><dd>{row.missing_fields.length ? row.missing_fields.map(label).join(" · ") : d.noneMissing}</dd>
      </dl>
      {prov.length > 0 && (
        <>
          <h4>{d.provenance}</h4>
          <div className="data-table-scroll"><table className="data-table compact">
            <thead><tr><th>{d.field}</th><th>{d.source}</th><th>{d.fetched}</th><th>{d.confidence}</th></tr></thead>
            <tbody>
              {prov.map((p) => (
                <tr key={p.field}><td>{label(p.field)}</td><td dir="ltr">{p.source}</td><td>{formatDate(p.at, locale, timeZone)}</td><td>{pct(p.confidence)}</td></tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
    </section>
  );
}
