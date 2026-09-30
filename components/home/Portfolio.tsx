import type { HomeContent } from "@/content/home";
import type { Locale } from "@/lib/i18n";
import { getFeaturedCaseStudies } from "@/services/case-studies";
import { CaseStudyGrid } from "@/components/case-studies/CaseStudyGrid";
import { EmptyState } from "@/components/ui/EmptyState";

interface PortfolioProps {
  content: HomeContent["portfolio"];
  locale: Locale;
}

export async function Portfolio({ content, locale }: PortfolioProps) {
  const caseStudies = await getFeaturedCaseStudies();

  return (
    <section className="ed-section surface" id="work">
      <div className="ed-section-inner">
        <div className="ed-portfolio-head">
          <div>
            <h2>{content.heading}</h2>
            <p>{content.subtitle}</p>
          </div>
          {caseStudies.length > 0 ? (
            <span className="ed-portfolio-count">
              {caseStudies.length} {content.countLabel}
            </span>
          ) : null}
        </div>

        {caseStudies.length === 0 ? (
          <EmptyState title={locale === "ar" ? "لا توجد مشاريع بعد" : "No projects yet"} />
        ) : (
          <CaseStudyGrid caseStudies={caseStudies} locale={locale} />
        )}
      </div>
    </section>
  );
}
