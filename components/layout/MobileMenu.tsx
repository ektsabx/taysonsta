"use client";

import { useState } from "react";
import Link from "next/link";

interface NavItem {
  href: string;
  label: string;
}

interface MobileMenuProps {
  navItems: NavItem[];
  menuLabel: string;
  bookLabel: string;
  bookHref: string;
}

export function MobileMenu({ navItems, menuLabel, bookLabel, bookHref }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="ed-burger"
        aria-label={menuLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`ed-mobile-menu${open ? " open" : ""}`}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
        <div className="ed-mobile-divider" />
        <Link href={bookHref} className="ed-header-cta" onClick={() => setOpen(false)}>
          {bookLabel}
        </Link>
      </div>
    </>
  );
}
