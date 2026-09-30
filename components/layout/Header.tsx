import Link from "next/link";
import Image from "next/image";
import { getDictionary } from "@/content/dictionaries";
import { localizedPath, switchLocalePath, type Locale } from "@/lib/i18n";
import { getSiteSetting } from "@/services/settings";
import { storageUrl } from "@/lib/storage";
import { MobileMenu } from "./MobileMenu";

interface HeaderProps {
  locale: Locale;
  pathname: string;
}

export async function Header({ locale, pathname }: HeaderProps) {
  const dictionary = getDictionary(locale);
  const topbar = await getSiteSetting<{ ar: string; en: string }>("topbar_text");

  const homeHref = localizedPath(locale, "/");
  const aboutHref = localizedPath(locale, "/about");
  const solutionsHref = homeHref === "/" ? "/#solutions" : `${homeHref}#solutions`;
  const portfolioHref = localizedPath(locale, "/portfolio");
  const caseStudiesHref = localizedPath(locale, "/case-studies");
  const bookHref = localizedPath(locale, "/booking");
  const arHref = switchLocalePath(pathname, "ar");
  const enHref = switchLocalePath(pathname, "en");

  const navItems = [
    { href: homeHref, label: dictionary.nav.home },
    { href: aboutHref, label: dictionary.nav.about },
    { href: solutionsHref, label: dictionary.nav.services },
    { href: portfolioHref, label: dictionary.nav.portfolio },
    { href: caseStudiesHref, label: dictionary.nav.caseStudies },
  ];

  return (
    <>
      {topbar ? (
        <div className="ed-topbar">
          <span>{topbar[locale]}</span>
          <Link href={bookHref} className="ed-topbar-cta">
            {dictionary.nav.bookCall}
          </Link>
        </div>
      ) : null}

      <header className="ed-header">
        <div className="ed-header-inner">
          <div className="ed-header-left">
            <Link href={homeHref}>
              <Image className="ed-logo" src={storageUrl("img/logo.png")} alt="Taysonsta" width={120} height={28} priority />
            </Link>
          </div>

          <nav className="ed-nav">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ed-actions">
            <Link href={locale === "ar" ? enHref : arHref} className="ed-lang-toggle">
              {locale === "ar" ? "EN" : "عربي"}
            </Link>
            <Link href={bookHref} className="ed-header-cta">
              {dictionary.nav.bookCall}
            </Link>
            <MobileMenu
              navItems={navItems}
              menuLabel={dictionary.nav.menu}
              bookLabel={dictionary.nav.bookCall}
              bookHref={bookHref}
            />
          </div>
        </div>
      </header>
    </>
  );
}
