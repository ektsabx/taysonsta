import type { PortfolioCompany } from "@/services/portfolio-companies";
import type { Dictionary } from "@/content/dictionaries";
import type { Locale } from "@/lib/i18n";

interface CompanyDetailCardProps {
  company: PortfolioCompany;
  locale: Locale;
  dictionary: Dictionary;
}

export function CompanyDetailCard({ company, locale, dictionary }: CompanyDetailCardProps) {
  const industry = locale === "ar" ? company.industry_ar : company.industry_en;
  const shortDescription = locale === "ar" ? company.short_description_ar : company.short_description_en;

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: dictionary.portfolio.relationship, value: dictionary.portfolio.relationshipLabel[company.relationship_type] });
  if (industry) rows.push({ label: dictionary.portfolio.industry, value: industry });
  if (company.founded_year) rows.push({ label: dictionary.portfolio.founded, value: String(company.founded_year) });
  if (company.markets.length > 0) rows.push({ label: dictionary.portfolio.markets, value: company.markets.join(" · ") });
  if (company.users_count) rows.push({ label: dictionary.portfolio.usersLabel, value: company.users_count });
  rows.push({
    label: dictionary.portfolio.status,
    value: company.status === "active" ? dictionary.portfolio.statusActive : dictionary.portfolio.statusInactive,
  });

  return (
    <div className="cs-detail-card">
      <h2>{dictionary.portfolio.projectDetails}</h2>
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
      {company.website_url ? (
        <a href={company.website_url} target="_blank" rel="noreferrer" className="admin-btn secondary cs-detail-link">
          {dictionary.portfolio.visitLive}
        </a>
      ) : null}
    </div>
  );
}
