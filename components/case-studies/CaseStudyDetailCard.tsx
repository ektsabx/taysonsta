import type { CaseStudy } from "@/services/case-studies";
import type { Dictionary } from "@/content/dictionaries";
import type { Locale } from "@/lib/i18n";

interface CaseStudyDetailCardProps {
  caseStudy: CaseStudy;
  locale: Locale;
  dictionary: Dictionary;
}

export function CaseStudyDetailCard({ caseStudy, locale, dictionary }: CaseStudyDetailCardProps) {
  const industry = locale === "ar" ? caseStudy.industry_ar : caseStudy.industry_en;
  const shortDescription = locale === "ar" ? caseStudy.short_description_ar : caseStudy.short_description_en;
  const country = locale === "ar" ? caseStudy.country_ar : caseStudy.country_en;

  const rows: { label: string; value: string }[] = [];
  if (caseStudy.client_name) rows.push({ label: dictionary.caseStudies.client, value: caseStudy.client_name });
  if (industry) rows.push({ label: dictionary.caseStudies.category, value: industry });
  if (country) rows.push({ label: dictionary.caseStudies.countryLabel, value: country });
  if (caseStudy.services.length > 0) rows.push({ label: dictionary.caseStudies.roleLabel, value: caseStudy.services.join(" · ") });
  if (caseStudy.users_count) rows.push({ label: dictionary.caseStudies.usersLabel, value: caseStudy.users_count });

  return (
    <div className="cs-detail-card">
      <h2>{dictionary.caseStudies.projectDetails}</h2>
      {shortDescription ? <p className="cs-detail-desc">{shortDescription}</p> : null}
      {rows.length > 0 ? (
        <dl className="cs-detail-list">
          {rows.map((row) => (
            <div className="cs-detail-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {caseStudy.website_url ? (
        <a href={caseStudy.website_url} target="_blank" rel="noreferrer" className="admin-btn secondary cs-detail-link">
          {dictionary.caseStudies.visitLive}
        </a>
      ) : null}
    </div>
  );
}
