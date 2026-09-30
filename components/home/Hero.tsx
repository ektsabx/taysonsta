import Link from "next/link";
import type { HomeContent } from "@/content/home";
import { localizedPath, type Locale } from "@/lib/i18n";

interface HeroProps {
  content: HomeContent["hero"];
  locale: Locale;
}

export function Hero({ content, locale }: HeroProps) {
  return (
    <section id="home" className="ed-section ed-hero">
      <div className="ed-section-inner">
        <div className="ed-hero-main">
          <h1>
            {content.headingBefore}
            <span className="hl">{content.headingHighlight}</span>
            {content.headingAfter}
          </h1>

          <p className="ed-hero-sub">{content.subheading}</p>

          <div className="ed-hero-ctas">
            <Link href={localizedPath(locale, "/booking")} className="ed-btn ed-btn-primary">
              {content.ctaLabel}
            </Link>
            <Link href="#work" className="ed-btn ed-btn-outline">
              {content.secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
