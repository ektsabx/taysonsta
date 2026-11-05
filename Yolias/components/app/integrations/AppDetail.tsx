"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Download, ExternalLink, Mail, Plus, Settings2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { disconnectCalendar } from "@/app/(app)/settings/calendar-actions";
import { APP_CATEGORY, APP_HELP, type AppKey, type AppListing } from "@/lib/app-listings";
import { AppLogo, startUrl, useAppState } from "./shared";

// One detail page for every integration and add-on (owner, 2026-11-05):
// screenshots beside the name, what it does, how to connect or install it.
// Screenshots, version and links come from Yolias Admin.
export function AppDetail({ app, listing }: { app: AppKey; listing: AppListing }) {
  const { t } = useI18n();
  const h = t.settings.hub, a = h.apps, item = a.items[app], p = t.meetings.page;
  const s = useAppState();
  const [pending, start] = useTransition();
  const n = s.connected(app);
  const mail = app === "gmail" || app === "imap";
  const help = APP_HELP[app];
  const notice = app === "google-calendar" && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("calendar") : null;
  const connect = () => { const u = startUrl(app); if (u) window.location.assign(u); };
  const c = s.cal?.connection;

  return (
    <div className="sdr-page app-detail">
      <Link className="app-back" href="/integrations"><ArrowLeft className="flip-rtl" />{h.title}</Link>
      <div className="app-detail-grid">
        <div className="app-shots">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {listing.screenshots.map((src) => <img key={src} src={src} alt={item.name} loading="lazy" onError={(e) => { e.currentTarget.hidden = true; }} />)}
        </div>
        <div className="app-info">
          <div className="app-title"><AppLogo app={app} /><h2>{item.name}</h2></div>
          <p className="app-by"><span>{a.categories[APP_CATEGORY[app]]}</span>{a.by}{listing.version ? ` · ${fmt(a.version, { v: listing.version })}` : ""}</p>
          <div className="app-actions">
            {app === "pixel-helper" ? (
              <>
                {listing.storeUrl && <a className="sdr-btn primary" href={listing.storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink />{a.store}</a>}
                {listing.downloadUrl && <a className="sdr-btn" href={listing.downloadUrl} download><Download />{a.manual}</a>}
              </>
            ) : (
              <>
                {n > 0 && <span className="app-state"><Check />{fmt(a.active, { n: String(n) })}</span>}
                {app === "google-calendar" && c
                  ? <button type="button" className="sdr-btn" disabled={pending} onClick={() => start(async () => { await disconnectCalendar(); s.load(); })}>{p.disconnect}</button>
                  : mail
                    ? <Link className="sdr-btn primary" href={`/integrations/${app}/connect`}>{n > 0 ? <Settings2 /> : <Plus />}{n > 0 ? a.manage : h.connect}</Link>
                    : <button type="button" className="sdr-btn primary" disabled={!s.ready || !s.canConnect(app)} onClick={connect}><Plus />{s.ready && !s.canConnect(app) ? h.soon : h.connect}</button>}
              </>
            )}
          </div>
          {notice && p.calendar[notice as keyof typeof p.calendar] && <p className={notice === "connected" ? "meet-ok" : "meet-error"}>{p.calendar[notice as keyof typeof p.calendar]}</p>}
          {c?.status === "error" && app === "google-calendar" && <p className="meet-error">{c.error}</p>}
          {c && app === "google-calendar" && <p className="ws-hint">{fmt(p.connectedAs, { email: c.email ?? "Google" })}</p>}
          <p className="app-about">{item.about}</p>
          <ul className="app-points">{item.points.map((x) => <li key={x}><Check />{x}</li>)}</ul>
          {app === "pixel-helper" && <><h3>{a.installTitle}</h3><ol className="app-steps">{a.installSteps.map((x) => <li key={x}>{x}</li>)}</ol></>}
          <h3>{a.pricing}</h3>
          <p>{a.free}</p>
          <h3>{a.contact}</h3>
          <ul className="app-links">
            {help && <li><a href={help} target="_blank" rel="noopener"><BookOpen />{h.how}</a></li>}
            <li><a href="mailto:support@yolias.com" dir="ltr"><Mail />support@yolias.com</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
