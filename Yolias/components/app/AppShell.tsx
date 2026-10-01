"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight, BookOpen, ChevronRight, CircleHelp, MessageCircle,
  Activity, ChartColumnIncreasing, CreditCard, EllipsisVertical, Layers, LogOut, PanelLeftClose, PanelLeftOpen,
  Plug, Plus, SlidersHorizontal, Sparkles, User, UserSearch, Users,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useI18n } from "@/lib/i18n/client";
import { planLabel } from "@/lib/plans";
import { signOut } from "@/app/(app)/settings/actions";
import { SettingsModal } from "./SettingsModal";
import { ToastProvider } from "@/components/Toast";
import { StrategyNavItem } from "./StrategyNavItem";
import { SIDEBAR_COOKIE, type SettingsTab, type ShellData } from "./types";

const mainNav = [
  { href: "/", key: "yoliasAi", icon: Sparkles },
  { href: "/analytics", key: "analytics", icon: ChartColumnIncreasing },
  { href: "/campaigns", key: "campaigns", icon: Layers },
  { href: "/prospects", key: "prospects", icon: UserSearch },
] as const;

const menu: { tab: SettingsTab; icon: typeof User }[] = [
  { tab: "general", icon: SlidersHorizontal },
  { tab: "account", icon: User },
  { tab: "usage", icon: Activity },
  { tab: "billing", icon: CreditCard },
  { tab: "team", icon: Users },
];

export function AppShell({ data, initialClosed, children }: { data: ShellData; initialClosed: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [closed, setClosed] = useState(initialClosed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Remembered in a cookie so the server renders the same state (no flash).
  const toggleSidebar = (next: boolean) => {
    setClosed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "closed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popoverRef.current?.contains(t) && !triggerRef.current?.contains(t)) setMenuOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [menuOpen]);

  const openSettings = (tab: SettingsTab) => {
    setMenuOpen(false);
    setSettingsTab(tab);
  };

  const pinned = data.recent.filter((st) => st.pinned);
  const recent = data.recent.filter((st) => !st.pinned);

  // "+ New Strategy": back to Yolias AI with an empty prompt.
  const newStrategy = () => router.push(`/?new=${Date.now()}`);

  return (
    <ToastProvider closeLabel={t.common.close}>
    <div className={`app-shell${closed ? " sidebar-closed" : ""}`}>
      <aside className="sidebar">
        <button className="sidebar-toggle sidebar-open-button" type="button" aria-label={t.nav.openSidebar} onClick={() => toggleSidebar(false)}>
          <PanelLeftOpen className="flip-rtl" />
        </button>
        <button className="sidebar-toggle sidebar-close-button" type="button" aria-label={t.nav.closeSidebar} onClick={() => toggleSidebar(true)}>
          <PanelLeftClose className="flip-rtl" />
        </button>

        <div className="brand-area">
          <BrandLogo />
        </div>

        <div className="sidebar-action-wrap">
          <button className="btn-new-chat" type="button" onClick={newStrategy}>
            <Plus />
            <span>{t.nav.newStrategy}</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          <section className="nav-group">
            {mainNav.map(({ href, key, icon: Icon }) => (
              <Link key={href} href={href} className={`nav-item${pathname === href ? " active" : ""}`}>
                <div className="nav-item-inner">
                  <Icon />
                  <span>{t.nav[key]}</span>
                </div>
              </Link>
            ))}
          </section>

          {pinned.length > 0 && (
            <section className="nav-group">
              <h2 className="nav-heading">{t.nav.pinned}</h2>
              {pinned.map((st) => (
                <StrategyNavItem key={st.id} id={st.id} title={st.title} pinned active={pathname === `/strategies/${st.id}`} />
              ))}
            </section>
          )}

          <section className="nav-group">
            <h2 className="nav-heading">{t.nav.recentStrategy}</h2>
            {recent.length === 0 && <div className="nav-empty">{t.nav.recentEmpty}</div>}
            {recent.map((st) => (
              <StrategyNavItem key={st.id} id={st.id} title={st.title} pinned={false} active={pathname === `/strategies/${st.id}`} />
            ))}
          </section>
        </nav>

        <div className="sidebar-user-container">
          <div className={`user-menu-popover${menuOpen ? " open" : ""}`} ref={popoverRef}>
            {menu.map(({ tab, icon: Icon }) => (
              <button key={tab} className="menu-item" type="button" onClick={() => openSettings(tab)}>
                <Icon />
                <span>{t.settings.tabs[tab]}</span>
              </button>
            ))}
            <div className="menu-divider" />
            <button className="menu-item" type="button" onClick={() => openSettings("integration")}>
              <Plug />
              <span>{t.settings.tabs.integration}</span>
            </button>
            <div className="menu-sub" onMouseEnter={() => setHelpOpen(true)} onMouseLeave={() => setHelpOpen(false)}>
              <button className="menu-item" type="button" aria-haspopup="menu" aria-expanded={helpOpen} onClick={() => setHelpOpen((o) => !o)}>
                <CircleHelp />
                <span>{t.nav.getHelp}</span>
                <ChevronRight className="menu-chevron flip-rtl" />
              </button>
              {helpOpen && (
                <div className="menu-flyout" role="menu">
                  <Link className="menu-item" role="menuitem" href="/help-center" target="_blank" onClick={() => setMenuOpen(false)}>
                    <BookOpen />
                    <span>{t.nav.helpCenter}</span>
                    <ArrowUpRight className="menu-chevron" />
                  </Link>
                  {/* Opens the support chatbot once it is connected. */}
                  <button className="menu-item" role="menuitem" type="button" disabled>
                    <MessageCircle />
                    <span>{t.nav.getSupport}</span>
                    <span className="coming-soon">{t.common.comingSoon}</span>
                  </button>
                </div>
              )}
            </div>
            <div className="menu-divider" />
            <button className="menu-item" type="button" onClick={() => signOut()}>
              <LogOut />
              <span>{t.nav.logOut}</span>
            </button>
          </div>

          <div className="sidebar-user" title={t.nav.accountSettings} ref={triggerRef} onClick={() => setMenuOpen((o) => !o)}>
            <div className="avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {data.user.avatarUrl ? <img src={data.user.avatarUrl} alt="" /> : data.user.initials}
            </div>
            <div className="user-info">
              <div className="user-name-row">
                <span className="user-name">{data.user.name}</span>
                <span className="plan-badge">{planLabel(data.workspace.plan, t)}</span>
              </div>
            </div>
            <EllipsisVertical className="user-more" />
          </div>
        </div>
      </aside>

      <main className="main-area">{children}</main>

      {settingsTab && <SettingsModal data={data} tab={settingsTab} onTab={setSettingsTab} onClose={() => setSettingsTab(null)} />}
    </div>
    </ToastProvider>
  );
}
