import Link from "next/link";
import type { HomeContent } from "@/content/home";
import { localizedPath, type Locale } from "@/lib/i18n";
import { bookingServices, type BookingServiceId } from "@/content/booking-services";

interface PackagesProps {
  content: HomeContent["packages"];
  locale: Locale;
  bare?: boolean;
}

function hrefForPlan(planName: string, locale: Locale): string {
  const id = planName.toLowerCase() as BookingServiceId;
  const service = bookingServices[id];
  return localizedPath(locale, service ? service.path : bookingServices.mvp.path);
}

function PackagesGrid({ content, locale }: { content: HomeContent["packages"]; locale: Locale }) {
  return (
    <div className="ed-pricing-grid">
      {content.plans.map((plan) => (
        <div className={`ed-pricing-card${plan.highlighted ? " featured" : ""}`} key={plan.name}>
          <div className="ed-pricing-card-top">
            <div>
              <div className="ed-pricing-card-name-row">
                <h3>{plan.name}</h3>
                {plan.badge ? <span className="ed-pricing-badge">{plan.badge}</span> : null}
              </div>
              <p className="ed-pricing-card-desc">{plan.description}</p>
            </div>
            <div className="ed-pricing-price-wrap">
              <span className="ed-pricing-price-label">{plan.priceLabel}</span>
              <span className="ed-pricing-price">{plan.price}</span>
            </div>
          </div>

          <ul className="ed-pricing-list">
            {plan.deliverables.map((item) => (
              <li key={item}>
                <b>&#10003;</b>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Link href={hrefForPlan(plan.name, locale)} className={`ed-pricing-cta ed-btn${plan.highlighted ? " ed-btn-primary" : " ed-btn-outline"}`}>
            {content.ctaLabel}
          </Link>
        </div>
      ))}
    </div>
  );
}

export function Packages({ content, locale, bare }: PackagesProps) {
  if (bare) {
    return <PackagesGrid content={content} locale={locale} />;
  }

  return (
    <section className="ed-section" id="pricing">
      <div className="ed-section-inner">
        <div className="ed-pricing-head">
          <div>
            <h2>{content.heading}</h2>
            <p>{content.subtitle}</p>
          </div>
        </div>

        <PackagesGrid content={content} locale={locale} />

        <p className="ed-pricing-footnote">{content.footnote}</p>
      </div>
    </section>
  );
}
