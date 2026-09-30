import type { CaseStudy } from "@/services/case-studies";
import type { Locale } from "@/lib/i18n";

interface CaseStudyTestimonialProps {
  caseStudy: CaseStudy;
  locale: Locale;
}

export function CaseStudyTestimonial({ caseStudy, locale }: CaseStudyTestimonialProps) {
  const quote = locale === "ar" ? caseStudy.testimonial_quote_ar : caseStudy.testimonial_quote_en;
  const role = locale === "ar" ? caseStudy.testimonial_role_ar : caseStudy.testimonial_role_en;

  if (!quote) {
    return null;
  }

  const attribution = [caseStudy.testimonial_author, role].filter(Boolean).join(", ");

  return (
    <div>
      <p className="case-study-testimonial">&ldquo;{quote}&rdquo;</p>
      {attribution ? <p className="case-study-testimonial-author">{attribution}</p> : null}
    </div>
  );
}
