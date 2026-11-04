"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { ImapDialog } from "@/components/app/settings/EmailSettings";
import { APP_CATEGORY, APP_KEYS, type AppCategory, type AppKey } from "@/lib/app-listings";
import { AppLogo, startUrl, useAppState } from "./shared";

// Integrations (owner, 2026-11-05): a card for each tool, with Details and
// Connect. Every integration and add-on goes through this card and AppDetail.
export function AppStore() {
  const { t } = useI18n();
  const h = t.settings.hub, a = h.apps;
  const toast = useToast();
  const s = useAppState();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<AppCategory | "all">("all");
  const [imap, setImap] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("mailbox");
    if (!p) return;
    const it = t.settings.integration;
    toast({ connected: it.mailboxConnected, denied: it.mailboxDenied, not_configured: it.mailboxNotConfigured }[p] ?? it.mailboxFailed, p === "connected" ? undefined : "error");
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const name = (k: AppKey) => a.items[k].name;
  const shown = useMemo(() => {
    const f = q.trim().toLowerCase();
    return APP_KEYS.filter((k) => (cat === "all" || APP_CATEGORY[k] === cat) && (!f || `${a.items[k].name} ${a.items[k].short}`.toLowerCase().includes(f)));
  }, [q, cat, a]);
  const cats: (AppCategory | "all")[] = ["all", "email", "calendar", "tracking"];
  const connect = (k: AppKey) => { const u = startUrl(k); if (u) window.location.assign(u); else setImap(true); };

  return (
    <div className="sdr-page app-store">
      <header className="app-store-head">
        <div><h2>{h.title}</h2><p>{a.subtitle}</p></div>
        <label className="app-search"><Search /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={a.search} aria-label={a.search} /></label>
      </header>
      <div className="app-filters" role="tablist" aria-label={h.title}>
        {cats.map((c) => <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{a.categories[c]}</button>)}
      </div>
      <div className="app-grid">
        {shown.map((k) => {
          const n = s.connected(k);
          return (
            <article key={k} className="app-card">
              <AppLogo app={k} />
              <h3>{name(k)}</h3>
              <p>{a.items[k].short}</p>
              <div className="app-actions">
                <Link className="sdr-btn app-grow" href={`/integrations/${k}`}>{a.details}</Link>
                {k === "pixel-helper"
                  ? <Link className="sdr-btn" href={`/integrations/${k}`}><Plus />{a.install}</Link>
                  : n > 0
                    ? <Link className="sdr-btn" href={`/integrations/${k}`}><Check />{fmt(h.connected, { n: String(n) })}</Link>
                    : <button type="button" className="sdr-btn" disabled={!s.ready || !s.canConnect(k)} onClick={() => connect(k)}><Plus />{s.ready && !s.canConnect(k) ? h.soon : h.connect}</button>}
              </div>
            </article>
          );
        })}
      </div>
      {!shown.length && <p className="ws-hint app-none">{a.none}</p>}
      {imap && <ImapDialog onClose={() => setImap(false)} onConnected={() => { setImap(false); toast(t.settings.integration.mailboxConnected); s.load(); }} />}
    </div>
  );
}
