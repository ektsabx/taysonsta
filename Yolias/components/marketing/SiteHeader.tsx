"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { useI18n } from "@/lib/i18n/client";

// Header shared by every public page (home, product, pricing, resources, legal).
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  const s = t.site;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/product", label: s.product },
    { href: "/pricing", label: s.pricing },
    { href: "/help-center", label: s.helpCenter },
    { href: "/blog", label: s.blog },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const cta = signedIn ? "/" : "/signup";

  return (
    <header className="nav-shell sticky top-0 z-50">
      <nav className="site-width flex h-[68px] items-center justify-between gap-4" aria-label="Primary navigation">
        <Link href="/" className="focus-ring flex shrink-0 items-center rounded" aria-label={s.home}>
          <BrandLogo />
        </Link>
        <div className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <Link key={l.href} className={`nav-link focus-ring rounded${isActive(l.href) ? " active" : ""}`} href={l.href}>{l.label}</Link>
          ))}
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <LanguageMenu />
          {!signedIn && <Link className="nav-link focus-ring rounded" href="/login">{s.signIn}</Link>}
          <Link className="nav-cta focus-ring" href={cta}>{s.tryYolias}</Link>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageMenu />
          <button className="focus-ring rounded border border-neutral-300 p-2 text-neutral-800" type="button" aria-label={s.menu} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Menu width={20} height={20} />
          </button>
        </div>
      </nav>
      <div className={`mobile-menu border-t border-neutral-200 bg-white lg:hidden${open ? " open" : ""}`}>
        <div className="site-width flex flex-col gap-1 py-4">
          {links.map((l) => (
            <Link key={l.href} className="nav-link focus-ring rounded py-2" href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          {!signedIn && <Link className="nav-link focus-ring rounded py-2" href="/login">{s.signIn}</Link>}
          <Link className="nav-cta focus-ring mt-2" href={cta}>{s.tryYolias}</Link>
        </div>
      </div>
    </header>
  );
}
