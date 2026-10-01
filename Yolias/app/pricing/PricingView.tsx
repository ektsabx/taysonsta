"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Menu, Plus, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { sendMagicLink } from "@/app/(auth)/actions";
import { coreFeatureKeys, pricingCopy, usageRowKeys, type Lang, type PricingCopy } from "./content";

interface Props {
  /** Where each plan's "Try Yolias" goes: checkout when signed in, signup otherwise. */
  planHref: Record<"pro" | "growth" | "scale", string>;
  signedIn: boolean;
}

const LANG_KEY = "yolias.lang";

export function PricingView({ planHref, signedIn }: Props) {
  const [lang, setLang] = useState<Lang>("en");
  const t = pricingCopy[lang];
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [policy, setPolicy] = useState<"privacyNotice" | "termsNotice" | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANG_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the visitor's saved language after hydration
    if (saved === "ar") setLang("ar");
  }, []);

  useEffect(() => {
    document.title = t.title;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {}
  }, [lang, t.title]);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks: { id: string; label: string }[] = [
    { id: "product", label: t.navProduct },
    { id: "solutions", label: t.navSolutions },
    { id: "pricing", label: t.navPricing },
    { id: "resources", label: t.navResources },
  ];

  const signInHref = signedIn ? "/" : "/login";
  const signInLabel = signedIn ? t.openApp : t.signIn;

  return (
    <div ref={rootRef} className={`mk${lang === "ar" ? " is-arabic" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} id="top">
      <header className="nav-shell sticky top-0 z-50">
        <nav className="site-width flex h-[72px] items-center justify-between gap-4" aria-label="Primary navigation">
          <a href="#top" onClick={(e) => { e.preventDefault(); scrollTo("top"); }} className="focus-ring flex shrink-0 items-center gap-2 rounded">
            <BrandLogo />
          </a>
          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((l) => (
              <a key={l.id} className="nav-link focus-ring rounded" href={`#${l.id}`} onClick={(e) => { e.preventDefault(); scrollTo(l.id); }}>{l.label}</a>
            ))}
          </div>
          <div className="hidden items-center gap-4 lg:flex">
            <LanguageControl lang={lang} onChange={setLang} />
            <Link className="nav-link focus-ring rounded" href={signInHref}>{signInLabel}</Link>
            <Link className="primary-button cta-pill focus-ring" href={planHref.growth}>{t.tryYolias}</Link>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageControl lang={lang} onChange={setLang} />
            <button className="focus-ring rounded border border-neutral-300 p-2 text-neutral-800" type="button" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <Menu width={20} height={20} />
            </button>
          </div>
        </nav>
        <div className={`mobile-menu border-t border-neutral-200 bg-white lg:hidden${menuOpen ? " open" : ""}`}>
          <div className="site-width flex flex-col gap-1 py-4">
            {navLinks.map((l) => (
              <a key={l.id} className="nav-link focus-ring rounded py-2" href={`#${l.id}`} onClick={(e) => { e.preventDefault(); scrollTo(l.id); }}>{l.label}</a>
            ))}
            <Link className="nav-link focus-ring rounded py-2" href={signInHref}>{signInLabel}</Link>
            <Link className="primary-button focus-ring mt-2" href={planHref.growth}>{t.tryYolias}</Link>
          </div>
        </div>
      </header>

      <main>
        <section id="pricing" className="hero">
          <div className="hero-fade">
            <div className="site-width text-center">
              <p className="eyebrow">{t.heroEyebrow}</p>
              <h1 className="display-font hero-title mt-5">{t.heroTitle}</h1>
              <p className="hero-copy">{t.heroCopy}</p>
              <p className="mt-5 text-[.95rem] font-semibold text-neutral-700">{t.heroSupport}</p>
              <p className="philosophy"><Sparkles width={15} height={15} aria-hidden="true" /><span>{t.philosophy}</span></p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="site-width">
            <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
              <PlanCard t={t} name={t.proName} price={t.proPrice} description={t.proDescription} usage={t.limitedUsage} href={planHref.pro} />
              <PlanCard t={t} name={t.growthName} price={t.growthPrice} description={t.growthDescription} usage={t.moreUsage} href={planHref.growth} recommended />
              <PlanCard t={t} name={t.scaleName} price={t.scalePrice} description={t.scaleDescription} usage={t.highUsage} href={planHref.scale} />
            </div>
            <div className="mt-8 text-center">
              <p className="text-[1.04rem] font-bold text-neutral-900">{t.unlimitedEveryPlan}</p>
              <div className="mt-5 space-y-1 text-sm text-neutral-500">
                <p>{t.usageLimits}</p>
                <p>{t.taxNotice}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="border-t border-neutral-200 bg-[#f7f7f5] py-20 lg:py-28">
          <div className="site-width">
            <div className="max-w-2xl">
              <p className="eyebrow">{t.comparisonEyebrow}</p>
              <h2 className="display-font mt-4 text-[clamp(2.45rem,5vw,4.2rem)] font-semibold leading-[1.04] tracking-[-.05em]">{t.comparisonTitle}</h2>
              <p className="mt-5 max-w-xl text-[1.03rem] leading-8 text-neutral-600">{t.comparisonCopy}</p>
            </div>
            <div className="comparison-wrap mt-11">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>{t.feature}</th>
                    <th>{t.proName}</th>
                    <th>{t.growthName}</th>
                    <th>{t.scaleName}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="section-row"><td colSpan={4}>{t.coreFeatures}</td></tr>
                  {coreFeatureKeys.map((k) => (
                    <tr key={k}>
                      <td>{k in t ? (t[k as keyof PricingCopy] as string) : k}</td>
                      {[0, 1, 2].map((i) => (
                        <td key={i}><span className="included"><Check width={16} height={16} /><span>{t.included}</span></span></td>
                      ))}
                    </tr>
                  ))}
                  <tr className="section-row"><td colSpan={4}>{t.usageCapacity}</td></tr>
                  {usageRowKeys.map((k) => (
                    <tr key={k}>
                      <td>{t[k]}</td>
                      <td>{t.limited}</td>
                      <td>{t.more}</td>
                      <td>{t.high}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="solutions" className="bg-white py-20 lg:py-28">
          <div className="site-width max-w-[900px]">
            <div className="text-center">
              <p className="eyebrow">{t.faqEyebrow}</p>
              <h2 className="display-font mt-4 text-[clamp(2.45rem,5vw,4.2rem)] font-semibold leading-[1.04] tracking-[-.05em]">{t.faqTitle}</h2>
            </div>
            <div className="mt-10">
              {t.faq.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
            </div>
          </div>
        </section>

        <section id="signup" className="final-section py-20 lg:py-28">
          <div className="site-width">
            <div className="grid items-center gap-12 lg:grid-cols-[.95fr_1.05fr]">
              <div>
                <p className="eyebrow text-[#ff7772]!">{t.finalEyebrow}</p>
                <h2 className="display-font mt-4 max-w-xl text-[clamp(2.8rem,5vw,4.6rem)] font-semibold leading-[1.02] tracking-[-.055em] text-white">{t.finalTitle}</h2>
                <p className="mt-6 max-w-xl text-[1.08rem] leading-8 text-neutral-300">{t.finalCopy}</p>
                <p className="mt-7 text-sm font-bold text-[#ffaaa6]">{t.philosophy}</p>
              </div>
              <SignupPanel t={t} signedIn={signedIn} />
            </div>
          </div>
        </section>
      </main>

      <footer id="resources" className="bg-[#090909] py-14 text-white">
        <div className="site-width">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <a href="#top" onClick={(e) => { e.preventDefault(); scrollTo("top"); }} className="focus-ring inline-flex rounded" aria-label="Yolias home">
                <BrandLogo tone="light" />
              </a>
              <p className="mt-4 max-w-[220px] text-sm leading-6 text-neutral-300">{t.footerTagline}</p>
              <div className="mt-4 flex items-center gap-4" aria-label="Social media links">
                <a className="footer-link focus-ring rounded" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><InstagramIcon /></a>
                <a className="footer-link focus-ring rounded" href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><LinkedinIcon /></a>
                <a className="footer-link focus-ring rounded" href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.6 22H2.4l7.3-8.4L1.9 2h6.5l4.5 6.9L18.9 2Zm-1.1 18h1.7L7.4 3.9H5.6L17.8 20Z" />
                  </svg>
                </a>
                <a className="footer-link focus-ring rounded" href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FacebookIcon /></a>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{t.resources}</p>
              <div className="mt-4 flex flex-col gap-3">
                <a className="footer-link focus-ring rounded" href="#resources">{t.helpCenter}</a>
                <a className="footer-link focus-ring rounded" href="#resources">{t.documentation}</a>
                <a className="footer-link focus-ring rounded" href="#solutions" onClick={(e) => { e.preventDefault(); scrollTo("solutions"); }}>{t.faqLink}</a>
                <a className="footer-link focus-ring rounded" href="#resources">{t.blog}</a>
                <a className="footer-link focus-ring rounded" href="#signup" onClick={(e) => { e.preventDefault(); scrollTo("signup"); }}>{t.contactSupport}</a>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{t.company}</p>
              <div className="mt-4 flex flex-col gap-3">
                <a className="footer-link focus-ring rounded" href="#resources">{t.about}</a>
                <a className="footer-link focus-ring rounded" href="#resources">{t.careers}</a>
                <a className="footer-link focus-ring rounded" href="#signup" onClick={(e) => { e.preventDefault(); scrollTo("signup"); }}>{t.contact}</a>
                <a className="footer-link focus-ring rounded" href="#resources">{t.taysonsta}</a>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{t.legal}</p>
              <div className="mt-4 flex flex-col gap-3">
                <button className="footer-link focus-ring w-fit rounded bg-transparent p-0 text-start" type="button" onClick={() => setPolicy("privacyNotice")}>{t.privacy}</button>
                <button className="footer-link focus-ring w-fit rounded bg-transparent p-0 text-start" type="button" onClick={() => setPolicy("termsNotice")}>{t.terms}</button>
                <a className="footer-link focus-ring rounded" href="#resources">{t.cookies}</a>
                <a className="footer-link focus-ring rounded" href="#resources">{t.security}</a>
              </div>
            </div>
          </div>
          {policy && <p className="mt-8 border-t border-white/10 pt-5 text-sm leading-6 text-neutral-400" role="status">{t[policy]}</p>}
          <div className="mt-10 border-t border-white/10 pt-6 text-sm text-neutral-500">{t.copyright}</div>
        </div>
      </footer>
    </div>
  );
}

function LanguageControl({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div ref={ref} className={`language-control${open ? " open" : ""}`} role="group" aria-label="Language selector">
      <button className="language-trigger focus-ring" type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{lang === "ar" ? "العربية" : "EN"}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <div className="language-menu" role="menu">
        {(["en", "ar"] as Lang[]).map((l) => (
          <button key={l} className={`focus-ring${l === lang ? " active" : ""}`} type="button" role="menuitem" onClick={() => { onChange(l); setOpen(false); }}>
            {l === "ar" ? "العربية" : "EN"}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanCard({ t, name, price, description, usage, href, recommended = false }: {
  t: PricingCopy; name: string; price: string; description: string; usage: string; href: string; recommended?: boolean;
}) {
  return (
    <article className={`pricing-card${recommended ? " recommended" : ""}`}>
      {recommended && <span className="recommended-label">{t.recommended}</span>}
      <h2 className="plan-name">{name}</h2>
      <p className="price">{price}</p>
      <p className="price-note">{t.perMonth}</p>
      <p className="plan-description">{description}</p>
      <div className="plan-divider" />
      <ul className="plan-list">
        <li><Check width={17} height={17} /><span>{t.sameFeatures}</span></li>
        <li><Check width={17} height={17} /><span>{t.unlimitedUsers}</span></li>
        <li><Check width={17} height={17} /><span>{usage}</span></li>
      </ul>
      <Link className={`${recommended ? "primary-button" : "outline-button"} focus-ring mt-auto w-full`} href={href}>{t.tryYolias}</Link>
    </article>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`faq-item${open ? " open" : ""}`}>
      <button className="faq-trigger focus-ring" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <Plus className="faq-icon" width={20} height={20} />
      </button>
      <div className="faq-answer">{a}</div>
    </article>
  );
}

// Final-section form: creates a real Yolias account (magic link). Name and
// company are stored and pre-fill onboarding.
function SignupPanel({ t, signedIn }: { t: PricingCopy; signedIn: boolean }) {
  const [status, setStatus] = useState<{ kind: "error" | "success" | "loading"; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (signedIn) {
    return (
      <div className="form-panel p-6 sm:p-8">
        <h3 className="text-2xl font-bold tracking-[-.035em]">{t.formTitle}</h3>
        <Link className="primary-button focus-ring mt-6 w-full" href="/">{t.openApp}<ArrowRight width={17} height={17} /></Link>
      </div>
    );
  }

  return (
    <div className="form-panel p-6 sm:p-8">
      <h3 className="text-2xl font-bold tracking-[-.035em]">{t.formTitle}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{t.formIntro}</p>
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          if (!form.checkValidity()) {
            form.reportValidity();
            setStatus({ kind: "error", text: t.validationError });
            return;
          }
          const fd = new FormData(form);
          setStatus({ kind: "loading", text: t.loading });
          start(async () => {
            const r = await sendMagicLink("signup", { status: "idle" }, fd);
            if (r.status === "sent") setStatus({ kind: "success", text: t.sent.replace("{email}", r.email) });
            else if (r.status === "error") setStatus({ kind: "error", text: r.message });
          });
        }}
      >
        <div>
          <label className="mb-2 block text-sm font-bold" htmlFor="full-name">{t.nameLabel}</label>
          <input className="form-field" id="full-name" name="full_name" type="text" required autoComplete="name" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold" htmlFor="work-email">{t.emailLabel}</label>
          <input className="form-field" id="work-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold" htmlFor="company-name">{t.companyLabel}</label>
          <input className="form-field" id="company-name" name="company" type="text" required autoComplete="organization" />
        </div>
        <button className="primary-button focus-ring w-full" type="submit" disabled={pending}>
          <span>{pending ? t.loading : t.submitIntent}</span>
          <ArrowRight width={17} height={17} />
        </button>
        {status && <p className={`status-message status-${status.kind}`} role="status" aria-live="polite">{status.text}</p>}
      </form>
    </div>
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
