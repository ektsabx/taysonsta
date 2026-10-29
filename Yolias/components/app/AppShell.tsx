"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, ArrowUpRight, BookOpen, Bug, CalendarDays, ChartColumnIncreasing, ChevronRight, CircleHelp, CreditCard, EllipsisVertical, Gift, Library, LogOut, Menu, MessageCircle, MessageSquareText, MessagesSquare, PanelLeftClose, PanelLeftOpen, PlayCircle, Plug, Plus, Send, SlidersHorizontal, SquareKanban, User, UserSearch, Users, UsersRound, X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { NotificationBell } from "./NotificationBell";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { planLabel, topPlan } from "@/lib/plans";
import { signOut } from "@/app/(app)/settings/actions";
import { SettingsModal } from "./SettingsModal";
import { SupportLink } from "@/components/SupportLink";
import { COMMUNITY_URL } from "@/lib/community";
import { FeedbackModal } from "./FeedbackModal";
import { ReviewPrompt } from "./ReviewPrompt";
import { ToastProvider } from "@/components/Toast";
import { StrategyNavItem } from "./StrategyNavItem";
import { SIDEBAR_COOKIE, type SettingsTab, type ShellData } from "./types";
import { WelcomeVideoModal } from "./WelcomeVideoModal";
import { PlanGateModal } from "./PlanGateModal";
import { ActivityPing } from "./ActivityPing";
import { OPEN_SETTINGS_EVENT } from "./open-settings";

const mainNav = [
  { href: "/", key: "yoliasAi", icon: MessageSquareText },
  { href: "/analytics", key: "analytics", icon: ChartColumnIncreasing },
  // Search results is a tab inside Prospects (owner, 2026-10-19), not its own sidebar page.
  { href: "/prospects", key: "prospects", icon: UserSearch },
] as const;

// Customer acquisition after discovery (D-193..D-195).
const workNav = [
  // Campaigns and Conversations are two pages again (D-256, after AgentSDR's Campaigns and Inbox).
  { href: "/outreach", key: "campaigns", icon: Send },
  { href: "/inbox", key: "conversations", icon: MessagesSquare },
  { href: "/crm", key: "crm", icon: SquareKanban },
  // Meetings inside Yolias (D-267): bookings and the booking page.
  { href: "/meetings", key: "meetings", icon: CalendarDays },
  // Company Knowledge is a regular page (owner, 2026-10-19): no "AI Workspace" section, no AI Agent page.
  { href: "/ai/knowledge", key: "knowledge", icon: Library },
] as const;

const isActive = (pathname: string, href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

const menu: { tab: SettingsTab; icon: typeof User }[] = [
  { tab: "general", icon: SlidersHorizontal },
  { tab: "account", icon: User },
  { tab: "usage", icon: Activity },
  { tab: "billing", icon: CreditCard },
  { tab: "team", icon: Users },
  { tab: "referral", icon: Gift },
];

// Phones and small tablets (same breakpoint as the CSS): the sidebar is a
// drawer over the page, hidden until the menu button opens it (like Claude).
const NARROW = "(max-width: 900px)";
const isNarrow = () => typeof window !== "undefined" && window.matchMedia(NARROW).matches;

export function AppShell({ data, initialClosed, children }: { data: ShellData; initialClosed: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  // A live renewal is waiting for payment (lib/billing.ts billingSweep): say so everywhere until it's paid.
  const pastDue = data.workspace.subscriptionStatus === "past_due" ? { id: data.invoices.find((i) => i.status === "open")?.id ?? null } : null;
  const pathname = usePathname();
  const router = useRouter();
  const [closed, setClosed] = useState(initialClosed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(data.welcome.show);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Desktop: a collapsible sidebar, remembered in a cookie so the server
  // renders the same state. Phones: a separate drawer state that the CSS keeps
  // hidden until opened, so the first paint never shows a half-open menu.
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const toggleSidebar = (next: boolean) => {
    if (isNarrow()) {
      setMobileOpen(!next);
      return;
    }
    setClosed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "closed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  // The drawer closes after every navigation.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  // While the drawer is open: Escape closes it, the page behind doesn't
  // scroll, focus moves into it and returns to the menu button afterwards.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    const main = document.querySelector<HTMLElement>(".main-area");
    const prev = main?.style.overflow;
    if (main) main.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const trigger = menuButtonRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      if (main) main.style.overflow = prev ?? "";
      trigger?.focus();
    };
  }, [mobileOpen]);

  // Leaving the phone layout (rotation, resize) never leaves the drawer open.
  useEffect(() => {
    const m = window.matchMedia(NARROW);
    const onChange = () => { if (!m.matches) setMobileOpen(false); };
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);

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

  // ?settings=<tab> opens that tab (e.g. back from connecting a mailbox).
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("settings");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "integration" || tab === "usage" || tab === "billing" || tab === "account" || tab === "referral") setSettingsTab(tab);
  }, []);

  // "Buy more prospects" buttons anywhere in the app open Settings → Usage.
  useEffect(() => {
    const onOpen = (e: Event) => setSettingsTab((e as CustomEvent<SettingsTab>).detail);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
  }, []);

  // Running out of prospects (like a usage limit): a banner from 80%, red at 100%.
  const [nearDismissed, setNearDismissed] = useState(false);
  const allowance = data.workspace.prospects;
  const usedPct = allowance ? Math.floor((data.usage.prospects / allowance) * 100) : 0;
  const limit = allowance && usedPct >= 100 ? "out" : allowance && usedPct >= 80 && !nearDismissed ? "near" : null;
  const canBuy = data.role === "owner" || data.role === "admin";

  const pinned = data.recent.filter((st) => st.pinned);
  const recent = data.recent.filter((st) => !st.pinned);

  // "+ New Strategy": back to Yolias AI with an empty prompt.
  const newStrategy = () => router.push(`/?new=${Date.now()}`);

  return (
    <ToastProvider closeLabel={t.common.close}>
    <div className={`app-shell${closed ? " sidebar-closed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
      {mobileOpen && <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setMobileOpen(false)} />}
      <aside
        className="sidebar"
        id="app-sidebar"
        aria-label={t.nav.menu}
        // A tap on any link inside closes the drawer, even when it leads to the current page.
        onClick={(e) => { if (mobileOpen && (e.target as HTMLElement).closest("a")) setMobileOpen(false); }}
      >
        <button className="sidebar-toggle sidebar-open-button" type="button" aria-label={t.nav.openSidebar} onClick={() => toggleSidebar(false)}>
          <PanelLeftOpen className="flip-rtl" />
        </button>
        <button ref={closeButtonRef} className="sidebar-toggle sidebar-close-button" type="button" aria-label={t.nav.closeSidebar} onClick={() => toggleSidebar(true)}>
          <PanelLeftClose className="flip-rtl" />
        </button>

        <div className="brand-area">
          {/* The logo always leads home: Yolias AI with an empty prompt. */}
          <Link href="/" className="brand-home" aria-label="Yolias" onClick={(e) => { e.preventDefault(); newStrategy(); }}>
            <BrandLogo />
          </Link>
          <NotificationBell unread={data.unread} />
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
              <Link key={href} href={href} prefetch className={`nav-item${isActive(pathname, href) ? " active" : ""}`}>
                <div className="nav-item-inner">
                  <Icon />
                  <span>{t.nav[key]}</span>
                </div>
              </Link>
            ))}
            {workNav.map(({ href, key, icon: Icon }) => (
              <Link key={href} href={href} prefetch className={`nav-item${isActive(pathname, href) ? " active" : ""}`}>
                <div className="nav-item-inner">
                  <Icon />
                  <span>{t.ws.nav[key]}</span>
                  {key === "conversations" && data.inboxUnread > 0 && <span className="nav-badge" aria-label={`${data.inboxUnread}`}>{data.inboxUnread > 99 ? "99+" : data.inboxUnread}</span>}
                </div>
              </Link>
            ))}
          </section>

          {pinned.length > 0 && (
            <section className="nav-group">
              <h2 className="nav-heading">{t.nav.pinned}</h2>
              {pinned.map((st) => (
                <StrategyNavItem key={st.id} id={st.id} title={st.title} pinned active={pathname === `/search/${st.id}`} />
              ))}
            </section>
          )}

          <section className="nav-group">
            <h2 className="nav-heading">{t.nav.recentStrategy}</h2>
            {recent.length === 0 && <div className="nav-empty">{t.nav.recentEmpty}</div>}
            {recent.map((st) => (
              <StrategyNavItem key={st.id} id={st.id} title={st.title} pinned={false} active={pathname === `/search/${st.id}`} />
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
            {/* The welcome video shows to new accounts after signup; not repeated in this menu (owner, 2026-10-21). */}
            <div className="menu-sub" onMouseEnter={() => setHelpOpen(true)} onMouseLeave={() => setHelpOpen(false)}>
              <button className="menu-item" type="button" aria-haspopup="menu" aria-expanded={helpOpen} onClick={() => setHelpOpen(true)}>
                <CircleHelp />
                <span>{t.nav.getHelp}</span>
                <ChevronRight className="menu-chevron flip-rtl" />
              </button>
              {helpOpen && menuOpen && (
                <div className="menu-flyout" role="menu">
                  <Link className="menu-item" role="menuitem" href="/help-center" target="_blank" onClick={() => setMenuOpen(false)}>
                    <BookOpen />
                    <span>{t.nav.helpCenter}</span>
                    <ArrowUpRight className="menu-chevron" />
                  </Link>
                  {/* Platform videos (owner, 2026-10-28), listed in Yolias Admin. */}
                  <Link className="menu-item" role="menuitem" href="/help-center/videos" target="_blank" onClick={() => setMenuOpen(false)}>
                    <PlayCircle />
                    <span>{t.nav.videos}</span>
                    <ArrowUpRight className="menu-chevron" />
                  </Link>
                  {/* Opens the support chat widget (D-140). */}
                  <SupportLink className="menu-item" role="menuitem" onOpen={() => setMenuOpen(false)}>
                    <MessageCircle />
                    <span>{t.nav.getSupport}</span>
                  </SupportLink>
                  <button className="menu-item" role="menuitem" type="button" onClick={() => { setMenuOpen(false); setFeedbackOpen(true); }}>
                    <Bug />
                    <span>{t.nav.reportBug}</span>
                  </button>
                  <a className="menu-item" role="menuitem" href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                    <UsersRound />
                    <span>{t.nav.joinCommunity}</span>
                    <ArrowUpRight className="menu-chevron" />
                  </a>
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

      <main className="main-area">
        <div className="mobile-topbar">
          <button ref={menuButtonRef} className="mobile-topbar-btn" type="button" aria-label={t.nav.openSidebar} aria-controls="app-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
            <Menu />
          </button>
          <button className="mobile-topbar-btn" type="button" aria-label={t.nav.newStrategy} onClick={newStrategy}>
            <Plus />
          </button>
        </div>
        {data.planGate && (
          <div className="plan-gate-banner" role="status">
            <span>{data.planGate.trialDays ? fmt(t.planGate.bannerTrial, { days: data.planGate.trialDays }) : t.planGate.banner}</span>
            <Link href="/checkout">{t.planGate.cta}</Link>
          </div>
        )}
        {pastDue && (
          <div className="past-due-banner" role="status">
            <span>{t.invoicePay.pastDue}</span>
            {pastDue.id && <Link href={`/invoices/${pastDue.id}`}>{t.invoicePay.pay}</Link>}
          </div>
        )}
        {!pastDue && limit && (
          <div className={`usage-limit-banner ${limit}`} role="status">
            <span>{limit === "out" ? t.buyMore.bannerOut : fmt(t.buyMore.bannerNear, { pct: usedPct })}</span>
            {canBuy && <button type="button" onClick={() => openSettings("usage")}>{t.buyMore.cta}</button>}
            {canBuy && data.workspace.plan !== topPlan && <Link href="/checkout">{t.buyMore.upgrade}</Link>}
            {limit === "near" && <button type="button" className="usage-limit-dismiss" aria-label={t.buyMore.dismiss} onClick={() => setNearDismissed(true)}><X /></button>}
          </div>
        )}
        {children}
      </main>

      {settingsTab && <SettingsModal data={data} tab={settingsTab} onTab={setSettingsTab} onClose={() => setSettingsTab(null)} />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {data.user.askReview && !welcomeOpen && <ReviewPrompt />}
      <ActivityPing />
      {data.planGate && !welcomeOpen && <PlanGateModal trialDays={data.planGate.trialDays} />}
      {welcomeOpen && data.welcome.video && <WelcomeVideoModal video={data.welcome.video} onClose={() => setWelcomeOpen(false)} />}
    </div>
    </ToastProvider>
  );
}
