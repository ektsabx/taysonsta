import { TRUSTPILOT_REVIEW_URL } from "@/lib/community";
import { customerCount, PRODUCT_HUNT_URL, testimonials, trustLogos } from "@/lib/content/social-proof";
import type { Locale } from "@/lib/i18n/config";

// Social proof sections (lib/content/social-proof.ts). Each renders nothing
// until real, approved data exists there.

const copy = {
  en: { trusted: "Trusted by businesses that are serious about growth.", customers: "Customers", loved: "Loved by marketers around the world", reviewUs: "Review us on Trustpilot", productHunt: "Yolias on Product Hunt" },
  ar: { trusted: "موثوق من الشركات الجادة في النمو.", customers: "عميل", loved: "يحبّه المسوّقون حول العالم", reviewUs: "قيّمنا على Trustpilot", productHunt: "يولـياس على Product Hunt" },
};

/** Official marks (Simple Icons, CC0): used only to link to Yolias on these services. */
function TrustpilotMark() {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#00B67A" d="M12 17.964l5.214-1.321 2.179 6.714L12 17.964zM24 9.286h-9.179L12 .643 9.179 9.286H0l7.429 5.357-2.821 8.643 7.429-5.357 4.571-3.286L24 9.286z" /></svg>;
}
function ProductHuntMark() {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#DA552F" d="M13.604 8.4h-3.405V12h3.405c.995 0 1.801-.806 1.801-1.801 0-.993-.805-1.799-1.801-1.799zM12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm1.604 14.4h-3.405V18H7.801V6h5.804c2.319 0 4.2 1.88 4.2 4.199 0 2.321-1.881 4.201-4.201 4.201z" /></svg>;
}

/** Logos under the pricing cards: a slow CSS marquee (no JavaScript), still for reduced motion. */
export function TrustLogos({ locale }: { locale: Locale }) {
  if (!trustLogos.length) return null;
  const row = trustLogos.map((l) => (
    // eslint-disable-next-line @next/next/no-img-element
    <li key={l.src}><img src={l.src} alt={l.name} width={l.width} height={l.height} loading="lazy" decoding="async" /></li>
  ));
  return (
    <section className="trust-logos" aria-label={copy[locale].trusted}>
      <h2 className="trust-logos-title">{copy[locale].trusted}</h2>
      <div className="trust-marquee">
        <ul className="trust-track">{row}</ul>
        <ul className="trust-track" aria-hidden="true">{row}</ul>
      </div>
    </section>
  );
}

/** The verified customer count, neutral avatars and links to Trustpilot / Product Hunt. */
export function CustomerCount({ locale }: { locale: Locale }) {
  if (!customerCount) return null;
  const c = copy[locale];
  return (
    <section className="section customer-count">
      <div className="site-width customer-count-row">
        <div className="customer-avatars" aria-hidden="true">
          {["A", "M", "S", "Y", "N"].map((x, i) => <span key={x} className={`customer-avatar a${i}`}>{x}</span>)}
        </div>
        <p className="customer-count-text">
          <strong dir="ltr">{customerCount.label}</strong> <span>{customerCount.basis[locale] || c.customers}</span>
        </p>
        <div className="customer-badges">
          <a href={TRUSTPILOT_REVIEW_URL} target="_blank" rel="noopener noreferrer" className="customer-badge"><TrustpilotMark /><span>{c.reviewUs}</span></a>
          {PRODUCT_HUNT_URL && <a href={PRODUCT_HUNT_URL} target="_blank" rel="noopener noreferrer" className="customer-badge"><ProductHuntMark /><span>{c.productHunt}</span></a>}
        </div>
      </div>
    </section>
  );
}

/** Real customer reviews only. */
export function Testimonials({ locale }: { locale: Locale }) {
  if (!testimonials.length) return null;
  return (
    <section className="section alt">
      <div className="site-width">
        <div className="section-head"><h2 className="display-font">{copy[locale].loved}</h2></div>
        <ul className="testimonials">
          {testimonials.map((t) => (
            <li key={t.name} className="testimonial">
              <blockquote>{t.quote[locale]}</blockquote>
              <div className="testimonial-person">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.photo ? <img src={t.photo} alt="" width={40} height={40} loading="lazy" /> : <span className="customer-avatar a0" aria-hidden="true">{t.name.slice(0, 1)}</span>}
                <span><strong>{t.name}</strong>{t.role && <small>{t.role[locale]}</small>}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
