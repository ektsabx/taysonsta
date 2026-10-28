"use client";

import { useEffect, useState } from "react";
import { AtSign, BookOpen, MoreHorizontal, Plug } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { GmailIcon } from "@/components/app/ConnectorIcons";
import { mailboxState, type EmailState } from "@/app/(app)/settings/mailbox-actions";
import { EmailSettings, ImapDialog } from "./EmailSettings";

// Settings → Integrations as cards (owner, 2026-10-28): one card per
// integration, so more can be added beside email. Opening a card shows what is
// inside it; its ⋯ menu has "Connect" and "How to connect" (the help article
// for that platform, with the provider's own guides).
type CardKey = "gmail" | "imap";

export function IntegrationsHub() {
  const { t } = useI18n();
  const h = t.settings.hub;
  const toast = useToast();
  const [open, setOpen] = useState<CardKey | null>(null);
  const [state, setState] = useState<EmailState | null>(null);
  const [imap, setImap] = useState(false);
  const [menu, setMenu] = useState<CardKey | null>(null);
  const load = () => mailboxState().then(setState).catch(() => setState(null));
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement | null)?.closest?.(".integration-card-menu")) setMenu(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  if (open) return <EmailSettings onBack={() => { setOpen(null); void load(); }} backLabel={h.back} />;

  const boxes = (state?.mailboxes ?? []).filter((m) => m.status !== "disconnected");
  const count = (p: string) => boxes.filter((m) => m.provider === p).length;
  const googleOn = Boolean(state?.available.includes("gmail"));
  const cards: { key: CardKey; name: string; desc: string; icon: React.ReactNode; connected: number; canConnect: boolean; connect: () => void; help: string }[] = [
    // An API route that redirects to Google: a full page load, not a client navigation.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    { key: "gmail", name: "Gmail", desc: h.gmailDesc, icon: <GmailIcon />, connected: count("gmail"), canConnect: googleOn, connect: () => window.location.assign("/api/integrations/gmail/start"), help: "/help-center/connect-gmail" },
    { key: "imap", name: h.imapName, desc: h.imapDesc, icon: <AtSign />, connected: count("imap"), canConnect: true, connect: () => setImap(true), help: "/help-center/connect-imap-smtp" },
  ];

  return (
    <div>
      <div className="sdr-section-head"><div><h4>{h.title}</h4><p>{h.subtitle}</p></div></div>
      <div className="integration-cards">
        {cards.map((c) => (
          <div key={c.key} className="integration-card">
            <button type="button" className="integration-card-main" onClick={() => setOpen(c.key)}>
              <span className="integration-card-logo">{c.icon}</span>
              <span className="integration-card-text">
                <strong>{c.name}</strong>
                <span>{c.desc}</span>
              </span>
              <span className={`sdr-badge nodot ${c.connected ? "green" : c.canConnect ? "gray" : "gray"}`}>
                {c.connected ? fmt(h.connected, { n: String(c.connected) }) : c.canConnect ? h.notConnected : h.soon}
              </span>
            </button>
            <div className="integration-card-menu">
              <button type="button" className="sdr-icon-btn" aria-label={h.more} aria-expanded={menu === c.key} onClick={(e) => { e.stopPropagation(); setMenu(menu === c.key ? null : c.key); }}><MoreHorizontal /></button>
              {menu === c.key && (
                <div className="sdr-menu-panel" role="menu">
                  <button type="button" role="menuitem" disabled={!c.canConnect} onClick={() => { setMenu(null); c.connect(); }}><Plug />{h.connect}</button>
                  <a role="menuitem" href={c.help} target="_blank" rel="noopener" onClick={() => setMenu(null)}><BookOpen />{h.how}</a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {imap && <ImapDialog onClose={() => setImap(false)} onConnected={() => { setImap(false); toast(t.settings.integration.mailboxConnected); void load(); }} />}
    </div>
  );
}
