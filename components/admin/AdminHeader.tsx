"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/admin/actions";
import { globalSearchAction } from "@/app/admin/_actions/common";
import { NotificationCenter } from "@/components/bos/NotificationCenter";
import { HeaderClock, type ClockProps } from "@/components/bos/ClockWidget";
import { SystemClock } from "@/components/bos/SystemClock";
import { BranchSelector } from "@/components/bos/BranchSelector";
import { useT, Tx } from "@/components/bos/I18n";
import { HeaderUiMenus } from "@/components/bos/UiPreferences";
import { PageGuideButton } from "@/components/bos/PageGuide";
import { ModuleSettingsLink } from "@/components/bos/ModuleSettingsLink";
import type { BosLocale, BosTheme } from "@/lib/bos/i18n/core";
import { SearchIcon, LogoutIcon, ChevronsLeftIcon, MenuIcon } from "./AdminIcons";

type Hit = Awaited<ReturnType<typeof globalSearchAction>>[number];

interface AdminHeaderProps {
  name: string;
  ui: { locale: BosLocale; theme: BosTheme };
  email: string;
  roleNames: string[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleMobile: () => void;
  unreadNotifications: number;
  clock: ClockProps | null;
  systemTime: { ms: number; timezone: string };
  branches: { items: { id: string; name: string }[]; selected: string | null };
  settingsHrefs: string[];
}

// Global search across leads, contacts, clients, deals, projects, tasks,
// files, tickets and knowledge articles, grouped by type (§64).
function GlobalSearch() {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  // Recent searches (docs/bos/30 §26) — a per-browser convenience only.
  const [recent, setRecent] = useState<string[]>([]);
  const loadRecent = () => {
    try { setRecent(JSON.parse(localStorage.getItem("bos_recent_searches") ?? "[]").slice(0, 8)); } catch { setRecent([]); }
  };
  const remember = (q: string) => {
    const v = q.trim();
    if (v.length < 2) return;
    try {
      const next = [v, ...recent.filter((r) => r !== v)].slice(0, 8);
      localStorage.setItem("bos_recent_searches", JSON.stringify(next));
      setRecent(next);
    } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function search(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const results = await globalSearchAction(q);
        setHits(results);
        setActive(0);
        setOpen(true);
      });
    }, 220);
  }

  const groups = hits.reduce<Record<string, Hit[]>>((acc, h) => {
    (acc[h.typeLabel] ??= []).push(h);
    return acc;
  }, {});

  return (
    <form
      ref={ref}
      className="admin-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (hits[active]) {
          remember(query);
          router.push(hits[active].href);
          setOpen(false);
        } else if (query.trim()) {
          remember(query);
          router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`);
          setOpen(false);
        }
      }}
    >
      <SearchIcon className="admin-search-icon" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          search(e.target.value);
        }}
        onFocus={() => { loadRecent(); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={t("بحث شامل... (Ctrl+K)")}
        aria-label={t("بحث شامل")}
      />
      {open && query.trim().length < 2 && recent.length ? (
        <div className="bos-search-results">
          <div className="bos-search-group">{t("عمليات بحث حديثة")}</div>
          {recent.map((r) => <button key={r} type="button" className="bos-search-hit" style={{ width: "100%", textAlign: "start", background: "none", border: 0, cursor: "pointer" }} onClick={() => { setQuery(r); search(r); }}>{r}</button>)}
        </div>
      ) : null}
      {open && query.trim().length >= 2 ? (
        <div className="bos-search-results">
          {pending && !hits.length ? <div className="bos-faint" style={{ padding: 12, fontSize: 12.5 }}>{t("جارٍ البحث...")}</div> : null}
          {!pending && !hits.length ? <div className="bos-faint" style={{ padding: 12, fontSize: 12.5 }}>{t("لا توجد نتائج لـ “{q}”", { q: query })}</div> : null}
          {Object.entries(groups).map(([label, list]) => (
            <div key={label}>
              <div className="bos-search-group">{t(label)}</div>
              {list.map((h) => (
                <Link key={`${h.type}-${h.id}`} href={h.href} className={`bos-search-hit${hits[active] === h ? " active" : ""}`} onClick={() => { remember(query); setOpen(false); }}>
                  {h.title}
                  {h.subtitle ? <small><Tx>{h.subtitle}</Tx></small> : null}
                </Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </form>
  );
}

export function AdminHeader({ name, ui, email, roleNames, collapsed, onToggleCollapsed, onToggleMobile, unreadNotifications, clock, systemTime, branches, settingsHrefs }: AdminHeaderProps) {
  const t = useT();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initial = (name.trim()[0] ?? email.trim()[0] ?? "A").toUpperCase();

  return (
    <header className="admin-topheader">
      <div className="admin-topheader-left">
        <button type="button" className="admin-icon-btn admin-desktop-only" onClick={onToggleCollapsed} aria-label={t("طي القائمة الجانبية")}>
          <ChevronsLeftIcon className={collapsed ? "rotated" : undefined} />
        </button>
        <button type="button" className="admin-icon-btn admin-mobile-only" onClick={onToggleMobile} aria-label={t("فتح القائمة")}>
          <MenuIcon />
        </button>
        <GlobalSearch />
      </div>

      <div className="bos-header-right">
        <BranchSelector branches={branches.items} selected={branches.selected} allLabel={t("كل الفروع")} />
        <SystemClock serverNowMs={systemTime.ms} timezone={systemTime.timezone} />
        {clock ? <HeaderClock {...clock} /> : null}
        <PageGuideButton />
        <ModuleSettingsLink allowed={settingsHrefs} />
        <HeaderUiMenus locale={ui.locale} theme={ui.theme} />
        <NotificationCenter initialUnread={unreadNotifications} />
        <div
          className="admin-profile"
          onMouseEnter={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
            setProfileOpen(true);
          }}
          onMouseLeave={() => {
            closeTimer.current = setTimeout(() => setProfileOpen(false), 150);
          }}
        >
          <button type="button" className="admin-profile-trigger" aria-expanded={profileOpen} onClick={() => setProfileOpen((v) => !v)}>
            <span className="admin-avatar"><Tx>{initial}</Tx></span>
            <span className="admin-profile-email">{name || email}</span>
          </button>
          <div className={`admin-profile-panel${profileOpen ? " open" : ""}`}>
            <div className="admin-profile-panel-email">
              <strong style={{ color: "var(--bos-strong)", display: "block" }}>{name}</strong>
              {email}
              {roleNames.length ? <div style={{ marginTop: 4 }}>{roleNames.map((r) => t(r)).join(" · ")}</div> : null}
            </div>
            <Link href="/admin/profile" className="admin-profile-logout" style={{ color: "rgba(var(--bos-fg-rgb), 0.8)" }}>
              {t("ملفي")}
            </Link>
            <button
              type="button"
              className="admin-profile-logout"
              disabled={isPending}
              onClick={() => startTransition(() => signOutAction())}
            >
              <LogoutIcon />
              {t("تسجيل الخروج")}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
