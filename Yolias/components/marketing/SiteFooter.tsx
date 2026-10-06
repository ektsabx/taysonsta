"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { SupportLink } from "@/components/SupportLink";
import { useI18n } from "@/lib/i18n/client";

// Official Yolias accounts.
const socials = [
  { label: "Facebook", href: "https://www.facebook.com/yoliasai", Icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/yolias.ai", Icon: InstagramIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@yolias.ai", Icon: TiktokIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/yolias.ai", Icon: LinkedinIcon },
  { label: "X", href: "https://x.com/yolias.ai", Icon: XIcon },
];

// Footer shared by every public page (from the pricing design).
export function SiteFooter() {
  const { t } = useI18n();
  const s = t.site;
  const columns = [
    {
      title: s.resources,
      links: [
        { href: "/help-center", label: s.helpCenter },
        { href: "/docs", label: s.documentation },
        { href: "/pricing#faq", label: s.faq },
        { href: "/blog", label: s.blog },
        { href: "/contact?topic=support", label: s.contactSupport },
      ],
    },
    {
      title: s.company,
      links: [
        { href: "/about", label: s.about },
        { href: "/contact", label: s.contact },
        { href: "https://taysonsta.com", label: s.taysonsta, external: true },
      ],
    },
    {
      title: s.legal,
      links: [
        { href: "/legal/privacy", label: s.privacy },
        { href: "/legal/terms", label: s.terms },
        { href: "/legal/refunds", label: s.refunds },
        { href: "/legal/cookies", label: s.cookies },
        { href: "/legal/security", label: s.security },
      ],
    },
  ];

  return (
    <footer className="bg-[#090909] py-14 text-white">
      <div className="site-width">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="focus-ring inline-flex rounded" aria-label={s.home}>
              <BrandLogo tone="light" />
            </Link>
            <p className="mt-4 max-w-[240px] text-sm leading-6 text-neutral-300">{s.tagline}</p>
            <div className="mt-4 flex items-center gap-4" aria-label={s.social}>
              {socials.map(({ label, href, Icon }) => (
                <a key={label} className="footer-link focus-ring rounded" href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon /></a>
              ))}
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-bold text-white">{col.title}</p>
              <div className="mt-4 flex flex-col gap-3">
                {col.links.map((l) =>
                  l.href === "/contact?topic=support" ? (
                    <SupportLink key={l.href} className="footer-link focus-ring w-fit rounded">{l.label}</SupportLink>
                  ) : "external" in l ? (
                    <a key={l.href} className="footer-link focus-ring w-fit rounded" href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
                  ) : (
                    <Link key={l.href} className="footer-link focus-ring w-fit rounded" href={l.href}>{l.label}</Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-neutral-500">{s.copyright}</div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TiktokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 2h-3.4v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .8.1V9.1a6.4 6.4 0 1 0 5.5 6.3V8.6a8 8 0 0 0 4.7 1.5V6.7a4.7 4.7 0 0 1-4.7-4.7Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.6 22H2.4l7.3-8.4L1.9 2h6.5l4.5 6.9L18.9 2Zm-1.1 18h1.7L7.4 3.9H5.6L17.8 20Z" />
    </svg>
  );
}
