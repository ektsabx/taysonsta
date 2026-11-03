"use client";

import { useEffect, useState } from "react";
import { Activity, Bell, ChevronRight, CreditCard, Gift, Search, SlidersHorizontal, User, Users, X } from "lucide-react";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { ReferralSettings } from "./settings/ReferralSettings";
import type { SettingsTab, ShellData } from "./types";
import { searchSettings } from "./settings-search";
import { GeneralTab } from "./settings/GeneralTab";
import { AccountTab } from "./settings/AccountTab";
import { NotificationsTab } from "./settings/NotificationsTab";
import { UsageTab } from "./settings/UsageTab";
import { BillingTab } from "./settings/BillingTab";
import { TeamTab } from "./settings/TeamTab";


const tabs: { tab: SettingsTab; icon: typeof User }[] = [
  { tab: "general", icon: SlidersHorizontal },
  { tab: "account", icon: User },
  { tab: "notifications", icon: Bell },
  { tab: "usage", icon: Activity },
  { tab: "billing", icon: CreditCard },
  { tab: "team", icon: Users },
  { tab: "referral", icon: Gift },
];
interface Props {
  data: ShellData;
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  onClose: () => void;
}
export function SettingsModal({ data, tab, onTab, onClose }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const searching = query.trim().length > 0;
  const hits = searching ? searchSettings(query, t, tabs.map((x) => x.tab)) : [];
  // Escape clears the search first, then closes the window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (query) setQuery("");
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, query]);

  const open = (hit: { tab: SettingsTab; id: string }) => {
    setQuery("");
    onTab(hit.tab);
    setFocus(hit.id);
  };
  // After a result opens its tab, bring the setting into view and mark it briefly.
  useEffect(() => {
    if (!focus) return;
    const el = document.querySelector<HTMLElement>(`[data-setting="${focus}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("setting-found");
    const id = window.setTimeout(() => { el.classList.remove("setting-found"); setFocus(null); }, 1800);
    return () => window.clearTimeout(id);
  }, [focus, tab]);


  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-window" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <aside className="modal-sidebar">
          <div className="modal-sidebar-title">{t.settings.title}</div>
          <div className="settings-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { e.preventDefault(); open(hits[0]); } }}
              placeholder={t.settings.search.placeholder}
              aria-label={t.settings.search.placeholder}
              aria-controls="settings-results"
              autoComplete="off"
            />
            {searching && <button type="button" className="settings-search-clear" onClick={() => setQuery("")} aria-label={t.settings.search.clear}><X /></button>}
          </div>
          <nav className="modal-nav-list">
            {tabs.map(({ tab: id, icon: Icon }) => (
              <button key={id} className={`modal-nav-item${id === tab && !searching ? " active" : ""}`} type="button" onClick={() => { setQuery(""); onTab(id); }}>
                <Icon />
                <span>{t.settings.tabs[id]}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="modal-content-area">
          <div className="modal-header-clean">
            <h3 id="settings-title">{searching ? t.settings.search.placeholder : t.settings.titles[tab]}</h3>
            <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t.common.close}>
              <X />
            </button>
          </div>
          <div className="modal-body-scroll">
            {searching ? (
              hits.length ? (
                <ul className="settings-results" id="settings-results">
                  {hits.map((h) => {
                    const Icon = tabs.find((x) => x.tab === h.tab)!.icon;
                    return (
                      <li key={`${h.tab}:${h.id}`}>
                        <button type="button" onClick={() => open(h)}>
                          <Icon aria-hidden="true" />
                          <span className="settings-result-main">
                            <span className="settings-result-label">{h.label}</span>
                            {h.desc && <span className="settings-result-desc">{h.desc}</span>}
                          </span>
                          <span className="settings-result-tab">{t.settings.tabs[h.tab]}</span>
                          <ChevronRight className="settings-result-go" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="settings-results-empty" id="settings-results" role="status">
                  <strong>{fmt(t.settings.search.empty, { q: query.trim() })}</strong>
                  <span>{t.settings.search.hint}</span>
                </div>
              )
            ) : <>
            {tab === "general" && <GeneralTab data={data} />}
            {tab === "account" && <AccountTab data={data} />}
            {tab === "notifications" && <NotificationsTab data={data} />}
            {tab === "usage" && <UsageTab data={data} />}
            {tab === "billing" && <BillingTab data={data} />}
            {tab === "team" && <TeamTab data={data} />}
            {tab === "referral" && <ReferralSettings link={data.workspace.referralLink} />}
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
