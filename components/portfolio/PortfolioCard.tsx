import Link from "next/link";
import Image from "next/image";
import type { PortfolioCompany } from "@/services/portfolio-companies";
import type { Dictionary } from "@/content/dictionaries";
import { localizedPath, type Locale } from "@/lib/i18n";
import { storageUrl } from "@/lib/storage";

interface PortfolioCardProps {
  company: PortfolioCompany;
  locale: Locale;
  dictionary: Dictionary;
}

export function PortfolioCard({ company, locale, dictionary }: PortfolioCardProps) {
  const shortDescription = locale === "ar" ? company.short_description_ar : company.short_description_en;
  const industry = locale === "ar" ? company.industry_ar : company.industry_en;

  return (
    <Link href={localizedPath(locale, `/portfolio/${company.slug}`)} className="case-study-card">
      {company.cover_image ? (
        <div className="case-study-card-cover">
          <Image src={storageUrl(company.cover_image)} alt={company.name} width={520} height={290} />
        </div>
      ) : null}
      <div className="case-study-card-body">
        <div className="case-study-card-client">{dictionary.portfolio.relationshipLabel[company.relationship_type]}</div>
        <div className="case-study-card-title">{company.name}</div>
        {shortDescription ? <p className="case-study-card-desc">{shortDescription}</p> : null}
        {industry || company.markets.length > 0 ? (
          <div className="case-study-card-meta">
            {industry ? <span>{industry}</span> : null}
            {company.markets.length > 0 ? <span>{company.markets.join(", ")}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
