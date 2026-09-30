import Link from "next/link";
import Image from "next/image";
import type { CaseStudy } from "@/services/case-studies";
import { localizedPath, type Locale } from "@/lib/i18n";
import { storageUrl } from "@/lib/storage";

interface CaseStudyCardProps {
  caseStudy: CaseStudy;
  locale: Locale;
}

export function CaseStudyCard({ caseStudy, locale }: CaseStudyCardProps) {
  const shortDescription = locale === "ar" ? caseStudy.short_description_ar : caseStudy.short_description_en;
  const country = locale === "ar" ? caseStudy.country_ar : caseStudy.country_en;

  return (
    <Link href={localizedPath(locale, `/case-studies/${caseStudy.slug}`)} className="case-study-card">
      {caseStudy.featured_image ? (
        <div className="case-study-card-cover">
          <Image src={storageUrl(caseStudy.featured_image)} alt={caseStudy.title} width={520} height={290} />
        </div>
      ) : null}
      <div className="case-study-card-body">
        {caseStudy.client_name ? <div className="case-study-card-client">{caseStudy.client_name}</div> : null}
        <div className="case-study-card-title">Founder &amp; CEO, {caseStudy.title}</div>
        {shortDescription ? <p className="case-study-card-desc">{shortDescription}</p> : null}
        {country ? (
          <div className="case-study-card-meta">
            <span>{country}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
