"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BosIcon } from "@/components/bos/icons";
import type { NavGroup } from "@/lib/bos/nav";
import { useT } from "@/components/bos/I18n";

interface AdminSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: () => void;
  navigation: NavGroup[];
}

function isActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer the most specific matching link (e.g. /admin/projects/tasks over /admin/projects).
  return !allHrefs.some((other) => other !== href && other.startsWith(`${href}/`) && (pathname === other || pathname.startsWith(`${other}/`)));
}

export function AdminSidebar({ collapsed, mobileOpen, onNavigate, navigation }: AdminSidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const allHrefs = navigation.flatMap((g) => (g.href ? [g.href] : (g.items ?? []).map((i) => i.href)));
  const activeGroup = navigation.find((g) => (g.href ? isActive(pathname, g.href, allHrefs) : g.items?.some((i) => isActive(pathname, i.href, allHrefs))))?.key;
  const [open, setOpen] = useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : []));

  const [prevGroup, setPrevGroup] = useState(activeGroup);
  if (activeGroup !== prevGroup) {
    setPrevGroup(activeGroup);
    if (activeGroup) setOpen((prev) => new Set(prev).add(activeGroup));
  }

  return (
    <>
      <aside className={`admin-sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`} suppressHydrationWarning>
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-brand-mark">T</span>
          {!collapsed ? <span className="admin-sidebar-brand-text">Taysonsta BOS</span> : null}
        </div>

        <nav className="admin-sidebar-nav" style={{ gap: 2 }}>
          {navigation.map((group) => {
            if (group.href) {
              const active = isActive(pathname, group.href, allHrefs);
              return (
                <Link
                  key={group.key}
                  href={group.href}
                  className={`admin-sidebar-link${active ? " active" : ""}`}
                  title={collapsed ? t(group.label) : undefined}
                  onClick={onNavigate}
                >
                  <BosIcon name={group.icon} className="admin-sidebar-icon" />
                  {!collapsed ? <span>{t(group.label)}</span> : null}
                </Link>
              );
            }
            const isOpen = open.has(group.key);
            return (
              <div className="bos-nav-group" key={group.key}>
                <button
                  type="button"
                  className={`bos-nav-group-btn${isOpen ? " open" : ""}${activeGroup === group.key ? " active" : ""}`}
                  title={collapsed ? t(group.label) : undefined}
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpen((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    })
                  }
                >
                  <BosIcon name={group.icon} className="admin-sidebar-icon" />
                  <span className="label">{t(group.label)}</span>
                  <span className="chev">▶</span>
                </button>
                {isOpen && !collapsed ? (
                  <div className="bos-nav-sub">
                    {group.items?.map((item) => (
                      <Link key={item.href} href={item.href} className={isActive(pathname, item.href, allHrefs) ? "active" : undefined} onClick={onNavigate}>
                        {t(item.label)}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
      {mobileOpen ? <div className="admin-sidebar-scrim" onClick={onNavigate} /> : null}
    </>
  );
}
