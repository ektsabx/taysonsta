import type { CaseStudy } from "@/services/case-studies";
import type { Locale } from "@/lib/i18n";
import { CaseStudyCard } from "./CaseStudyCard";

interface CaseStudyGridProps {
  caseStudies: CaseStudy[];
  locale: Locale;
}

export function CaseStudyGrid({ caseStudies, locale }: CaseStudyGridProps) {
  const colsClass = caseStudies.length === 1 ? " cols-1" : caseStudies.length === 2 ? " cols-2" : "";

  return (
    <div className={`case-study-grid${colsClass}`}>
      {caseStudies.map((caseStudy) => (
        <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} locale={locale} />
      ))}
    </div>
  );
}
