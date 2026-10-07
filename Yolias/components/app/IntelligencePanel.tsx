import { formatDate } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n/config";
import type { Json } from "@/types/database";

// What a member sees about a result: match and why, last updated and what's
// missing. Sources, provenance and confidence stay internal (owner decision
// 2026-10-07, D-165): they describe how Yolias works, not the prospect.
export function IntelligencePanel({ t, locale, timeZone, row }: {
  t: Dictionary; locale: Locale; timeZone: string;
  row: { match_score: number | null; match_reasons: Json; missing_fields: string[]; last_updated: string };
}) {
  const d = t.prospects.detail;
  const csv = t.prospects.csv as unknown as Record<string, string>;
  const names: Record<string, string> = { ...csv, description: d.about, funding_stage: csv.funding, hiring_roles: csv.hiringRoles };
  const label = (f: string) => names[{ full_name: "name", linkedin_url: "linkedin", employee_count: "employees", reviews_count: "reviews", maps_url: "mapsUrl", posted_at: "postedAt", website: "domain", facebook_url: "facebook", instagram_url: "instagram" }[f] ?? f] ?? f;
  const reasons = Array.isArray(row.match_reasons) ? (row.match_reasons as string[]) : [];
  return (
    <section className="detail-card">
      <h3>{d.intelligence}</h3>
      <dl className="detail-grid">
        <dt>{d.match}</dt><dd>{row.match_score != null ? `${row.match_score}%` : "—"}{reasons.length > 0 && <span className="cell-sub">{d.reasons}: {reasons.join(" · ")}</span>}</dd>
        <dt>{d.lastUpdated}</dt><dd>{formatDate(row.last_updated, locale, timeZone)}</dd>
        <dt>{d.missing}</dt><dd>{row.missing_fields.length ? row.missing_fields.map(label).join(" · ") : d.noneMissing}</dd>
      </dl>
    </section>
  );
}
