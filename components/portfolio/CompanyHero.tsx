import Image from "next/image";
import type { PortfolioCompany } from "@/services/portfolio-companies";
import type { Dictionary } from "@/content/dictionaries";
import type { Locale } from "@/lib/i18n";
import { storageUrl } from "@/lib/storage";
import { CompanyDetailCard } from "./CompanyDetailCard";

interface CompanyHeroProps {
  company: PortfolioCompany;
  locale: Locale;
  dictionary: Dictionary;
}

export function CompanyHero({ company, locale, dictionary }: CompanyHeroProps) {
  const industry = locale === "ar" ? company.industry_ar : company.industry_en;

  return (
    <div className="case-study-hero">
      {industry ? <div className="case-study-hero-client">{industry}</div> : null}
      <h1 className="case-study-hero-title">{company.name}</h1>
      <div className="cs-hero-grid">
        {company.cover_image ? (
          <div className="case-study-cover">
            <Image src={storageUrl(company.cover_image)} alt={company.name} width={980} height={560} />
          </div>
        ) : null}
        <CompanyDetailCard company={company} locale={locale} dictionary={dictionary} />
      </div>
    </div>
  );
}
