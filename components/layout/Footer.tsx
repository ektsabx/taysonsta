import Link from "next/link";
import Image from "next/image";
import { getDictionary } from "@/content/dictionaries";
import { localizedPath, type Locale } from "@/lib/i18n";
import { getSiteSetting } from "@/services/settings";
import { storageUrl } from "@/lib/storage";
import { SocialIcon, type SocialPlatform } from "./SocialIcon";
import { NewsletterForm } from "./NewsletterForm";

interface FooterProps {
  locale: Locale;
}

interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export async function Footer({ locale }: FooterProps) {
  const dictionary = getDictionary(locale);
  const contactEmail = await getSiteSetting<string>("contact_email");
  const socialLinks = (await getSiteSetting<SocialLink[]>("social_links")) ?? [];

  const homeHref = localizedPath(locale, "/");
  const aboutHref = localizedPath(locale, "/about");
  const solutionsHref = homeHref === "/" ? "/#solutions" : `${homeHref}#solutions`;
  const portfolioHref = localizedPath(locale, "/portfolio");
  const caseStudiesHref = localizedPath(locale, "/case-studies");
  const careersHref = localizedPath(locale, "/careers");
  const blogHref = localizedPath(locale, "/blogs");

  const footerDesc =
    locale === "ar"
      ? "نحوّل الأفكار إلى Startups، من استراتيجية المنتج والتحقق من السوق، إلى التصميم والتطوير والإطلاق والنمو."
      : "We turn ideas into Startups, from product strategy and market validation, to design, development, launch, and growth.";

  return (
    <footer className="ed-footer">
      <div className="ed-footer-inner">
        <div className="ed-footer-grid">
          <div>
            <Image className="ed-footer-logo" src={storageUrl("img/logo.png")} alt="Taysonsta" width={130} height={30} />
            <p className="ed-footer-desc">{footerDesc}</p>
            {contactEmail ? (
              <div className="ed-footer-contact">
                <a href={`mailto:${contactEmail}`}>
                  <svg viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                  {contactEmail}
                </a>
              </div>
            ) : null}
            {socialLinks.length > 0 ? (
              <div className="ed-footer-social">
                {socialLinks.map((social) => (
                  <a key={social.platform} className="ed-social-link" href={social.url} target="_blank" rel="noreferrer">
                    <SocialIcon platform={social.platform} />
                    {social.platform}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ed-footer-col">
            <h4>{dictionary.footer.quickLinks}</h4>
            <ul className="ed-footer-links">
              <li><Link href={homeHref}>{dictionary.nav.home}</Link></li>
              <li><Link href={aboutHref}>{dictionary.nav.about}</Link></li>
              <li><Link href={solutionsHref}>{dictionary.nav.services}</Link></li>
              <li><Link href={portfolioHref}>{dictionary.nav.portfolio}</Link></li>
              <li><Link href={caseStudiesHref}>{dictionary.nav.caseStudies}</Link></li>
              <li><Link href={careersHref}>{dictionary.nav.careers}</Link></li>
              <li><Link href={blogHref}>{dictionary.nav.blog}</Link></li>
            </ul>
          </div>

          <NewsletterForm
            heading={dictionary.footer.stayInLoop}
            description={dictionary.footer.newsletterDesc}
            placeholder={dictionary.footer.emailPlaceholder}
            submitLabel={dictionary.footer.subscribe}
            submittingLabel={dictionary.footer.subscribing}
            successMessage={dictionary.footer.subscribeSuccess}
            errorMessage={dictionary.footer.subscribeError}
          />
        </div>

        <div className="ed-footer-bottom">
          <p>{dictionary.footer.rights}</p>
        </div>
      </div>
    </footer>
  );
}
