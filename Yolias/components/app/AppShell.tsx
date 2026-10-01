"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, ChartColumnIncreasing, CreditCard, EllipsisVertical, History, Layers, LogOut, PanelLeftClose, PanelLeftOpen,
  Plug, Plus, SlidersHorizontal, Sparkles, User, UserSearch, Users,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { signOut } from "@/app/(app)/settings/actions";
import { SettingsModal } from "./SettingsModal";
import { SIDEBAR_COOKIE, type SettingsTab, type ShellData } from "./types";

const mainNav = [
  { href: "/", label: "Yolias AI", icon: Sparkles },
  { href: "/analytics", label: "Analytics", icon: ChartColumnIncreasing },
  { href: "/campaigns", label: "Campaigns", icon: Layers },
  { href: "/prospects", label: "Prospects", icon: UserSearch },
];

const menu: { tab: SettingsTab; label: string; icon: typeof User }[] = [
  { tab: "general", label: "General", icon: SlidersHorizontal },
  { tab: "account", label: "Account", icon: User },
  { tab: "usage", label: "Usage", icon: Activity },
  { tab: "billing", label: "Billing", icon: CreditCard },
  { tab: "team", label: "Team", icon: Users },
];

export function AppShell({ data, initialClosed, children }: { data: ShellData; initialClosed: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [closed, setClosed] = useState(initialClosed);
  const [menuOpen, setMenuOpen] = useState(false);
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

  // "+ New Strategy": back to Yolias AI with an empty prompt.
  const newStrategy = () => router.push(`/?new=${Date.now()}`);

  return (
    <div className={`app-shell${closed ? " sidebar-closed" : ""}`}>
      <aside className="sidebar">
        <button className="sidebar-toggle sidebar-open-button" type="button" aria-label="Open sidebar" onClick={() => toggleSidebar(false)}>
          <PanelLeftOpen />
        </button>
        <button className="sidebar-toggle sidebar-close-button" type="button" aria-label="Close sidebar" onClick={() => toggleSidebar(true)}>
          <PanelLeftClose />
        </button>

        <div className="brand-area">
          <BrandLogo />
        </div>

        <div className="sidebar-action-wrap">
          <button className="btn-new-chat" type="button" onClick={newStrategy}>
            <Plus />
            <span>New Strategy</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          <section className="nav-group">
            {mainNav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`nav-item${pathname === href ? " active" : ""}`}>
                <div className="nav-item-inner">
                  <Icon />
                  <span>{label}</span>
                </div>
              </Link>
            ))}
          </section>

          <section className="nav-group">
            <h2 className="nav-heading">Recent Strategy</h2>
            {data.recent.length === 0 && <div className="nav-empty">Your strategies will appear here.</div>}
            {data.recent.map((s) => (
              <Link key={s.id} href={`/strategies/${s.id}`} className={`nav-item${pathname === `/strategies/${s.id}` ? " active" : ""}`} title={s.title}>
                <div className="nav-item-inner">
                  <History />
                  <span>{s.title}</span>
                </div>
              </Link>
            ))}
          </section>
        </nav>

        <div className="sidebar-user-container">
          <div className={`user-menu-popover${menuOpen ? " open" : ""}`} ref={popoverRef}>
            {menu.map(({ tab, label, icon: Icon }) => (
              <button key={tab} className="menu-item" type="button" onClick={() => openSettings(tab)}>
                <Icon />
                <span>{label}</span>
              </button>
            ))}
            <div className="menu-divider" />
            <button className="menu-item" type="button" onClick={() => openSettings("integration")}>
              <Plug />
              <span>Integration</span>
            </button>
            <div className="menu-divider" />
            <button className="menu-item" type="button" onClick={() => signOut()}>
              <LogOut />
              <span>Log out</span>
            </button>
          </div>

          <div className="sidebar-user" title="Account settings" ref={triggerRef} onClick={() => setMenuOpen((o) => !o)}>
            <div className="avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {data.user.avatarUrl ? <img src={data.user.avatarUrl} alt="" /> : data.user.initials}
            </div>
            <div className="user-info">
              <div className="user-name-row">
                <span className="user-name">{data.user.name}</span>
                <span className="plan-badge">{data.workspace.planLabel}</span>
              </div>
            </div>
            <EllipsisVertical className="user-more" />
          </div>
        </div>
      </aside>

      <main className="main-area">{children}</main>

      {settingsTab && <SettingsModal data={data} tab={settingsTab} onTab={setSettingsTab} onClose={() => setSettingsTab(null)} />}
    </div>
  );
}
