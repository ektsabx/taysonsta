"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeMenu } from "@/components/ThemeMenu";
import { useI18n } from "@/lib/i18n/client";
import { solutions, solutionSlugs } from "@/lib/content/solutions";

type Item = { href: string; label: string; note?: string };
type Entry = { key: string; label: string; href?: string; items?: Item[] };

// Header shared by every public page: Yolias | Product | Solutions | Pricing |
// Resources. Solutions and Resources open a menu (click or keyboard; Escape
// or a click outside closes it). On phones the menu is a full-width panel
// with the same groups as expandable sections.
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const { t, locale } = useI18n();
  const s = t.site;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const entries: Entry[] = [
    { key: "product", label: s.product, href: "/product" },
    {
      key: "solutions", label: s.solutions,
      items: [
        ...solutionSlugs.map((slug) => ({ href: `/solutions/${slug}`, label: solutions[slug][locale].name, note: solutions[slug][locale].tagline })),
        { href: "/solutions", label: s.allSolutions },
      ],
    },
    { key: "pricing", label: s.pricing, href: "/pricing" },
    {
      key: "resources", label: s.resources,
      items: [
        { href: "/use-cases", label: s.useCases },
        { href: "/help-center", label: s.helpCenter },
        { href: "/docs", label: s.documentation },
        { href: "/blog", label: s.blog },
        { href: "/contact", label: s.contact },
      ],
    },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const groupActive = (e: Entry) => (e.href ? isActive(e.href) : (e.items ?? []).some((i) => isActive(i.href)));
  const cta = signedIn ? "/" : "/signup";

  // Close menus on navigation, Escape and outside clicks.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setMenu(null);
    setOpen(false);
  }
  useEffect(() => {
    if (!menu && !open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(null); setOpen(false); } };
    const onClick = (e: MouseEvent) => { if (!navRef.current?.contains(e.target as Node)) setMenu(null); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [menu, open]);

  return (
    <header className="nav-shell sticky top-0 z-50" ref={navRef}>
      <nav className="site-width flex h-[68px] items-center justify-between gap-4" aria-label="Primary navigation">
        {/* The public home page, also for signed-in visitors (whose "/" is the app). */}
        <Link href={signedIn ? "/home" : "/"} className="focus-ring flex shrink-0 items-center rounded" aria-label={s.home}>
          <BrandLogo />
        </Link>
        <ul className="nav-main hidden items-center gap-6 lg:flex">
          {entries.map((e) => (
            <li key={e.key} className="nav-entry">
              {e.href ? (
                <Link className={`nav-link focus-ring rounded${groupActive(e) ? " active" : ""}`} href={e.href}>{e.label}</Link>
              ) : (
                <>
                  <button
                    type="button"
                    className={`nav-link nav-trigger focus-ring rounded${groupActive(e) ? " active" : ""}`}
                    aria-expanded={menu === e.key}
                    aria-controls={`menu-${e.key}`}
                    onClick={() => setMenu((m) => (m === e.key ? null : e.key))}
                  >
                    <span>{e.label}</span>
                    <ChevronDown aria-hidden="true" className="nav-trigger-icon" />
                  </button>
                  {menu === e.key && (
                    <div className={`nav-dropdown${e.key === "solutions" ? " wide" : ""}`} id={`menu-${e.key}`}>
                      <ul>
                        {e.items!.map((i) => (
                          <li key={i.href}>
                            <Link className={`nav-dropdown-item focus-ring${isActive(i.href) ? " active" : ""}`} href={i.href}>
                              <strong>{i.label}</strong>
                              {i.note && <span>{i.note}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-3 lg:flex">
          <ThemeMenu />
          <LanguageMenu />
          <Link className="nav-cta focus-ring" href={cta}>{s.tryYolias}</Link>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeMenu />
          <LanguageMenu />
          <button className="nav-burger focus-ring" type="button" aria-label={s.menu} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X width={20} height={20} /> : <Menu width={20} height={20} />}
          </button>
        </div>
      </nav>
      <div id="mobile-menu" className={`mobile-menu border-t border-[var(--line)] bg-[var(--paper)] lg:hidden${open ? " open" : ""}`}>
        <div className="site-width flex flex-col gap-1 py-3">
          {entries.map((e) =>
            e.href ? (
              <Link key={e.key} className="mobile-nav-link focus-ring" href={e.href}>{e.label}</Link>
            ) : (
              <details key={e.key} className="mobile-nav-group">
                <summary className="mobile-nav-link focus-ring"><span>{e.label}</span><ChevronDown aria-hidden="true" /></summary>
                <ul>
                  {e.items!.map((i) => (
                    <li key={i.href}><Link className="mobile-nav-sublink focus-ring" href={i.href}>{i.label}</Link></li>
                  ))}
                </ul>
              </details>
            ),
          )}
          <Link className="nav-cta focus-ring mt-3" href={cta}>{s.tryYolias}</Link>
        </div>
      </div>
    </header>
  );
}
