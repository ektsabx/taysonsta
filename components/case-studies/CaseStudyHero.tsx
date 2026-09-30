import Image from "next/image";
import type { CaseStudy } from "@/services/case-studies";
import type { Dictionary } from "@/content/dictionaries";
import type { Locale } from "@/lib/i18n";
import { storageUrl } from "@/lib/storage";
import { CaseStudyDetailCard } from "./CaseStudyDetailCard";

interface CaseStudyHeroProps {
  caseStudy: CaseStudy;
  locale: Locale;
  dictionary: Dictionary;
}

export function CaseStudyHero({ caseStudy, locale, dictionary }: CaseStudyHeroProps) {
  const industry = locale === "ar" ? caseStudy.industry_ar : caseStudy.industry_en;

  return (
    <div className="case-study-hero">
      {industry || caseStudy.client_name ? (
        <div className="case-study-hero-client">{[caseStudy.client_name, industry].filter(Boolean).join(" · ")}</div>
      ) : null}
      <h1 className="case-study-hero-title">{caseStudy.title}</h1>
      <div className="cs-hero-grid">
        {caseStudy.featured_image ? (
          <div className="case-study-cover">
            <Image src={storageUrl(caseStudy.featured_image)} alt={caseStudy.title} width={980} height={560} />
          </div>
        ) : null}
        <CaseStudyDetailCard caseStudy={caseStudy} locale={locale} dictionary={dictionary} />
      </div>
    </div>
  );
}
