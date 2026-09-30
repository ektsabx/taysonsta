import Link from "next/link";
import type { HomeContent } from "@/content/home";
import { localizedPath, type Locale } from "@/lib/i18n";

interface FinalCTAProps {
  content: HomeContent["finalCta"];
  locale: Locale;
}

export function FinalCTA({ content, locale }: FinalCTAProps) {
  return (
    <section className="ed-section ed-final-cta" id="booking">
      <div className="ed-section-inner">
        <h2>{content.heading}</h2>
        <p>{content.body}</p>
        <div className="ed-final-cta-ctas">
          <Link href={localizedPath(locale, "/booking")} className="ed-btn ed-btn-primary">
            {content.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
