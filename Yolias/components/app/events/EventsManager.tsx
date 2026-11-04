"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, Check, CheckCircle2, ChevronLeft, Copy, ExternalLink, Pencil, RefreshCw, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { DateRange } from "@/components/app/campaigns/DateRange";
import { editPixelAction, pollTestEvents, savePixelSettings } from "@/app/(app)/events/actions";
import type { RangePreset } from "@/lib/campaigns/metrics";
import type { PixelOverview, TestEvent } from "@/services/events";

// One pixel in Events Manager (owner, 2026-11-02, D-274), after Facebook's:
// the pixel's name, id and status; Overview (events by day and by name);
// Test events (open your website with a test code and watch the events
// arrive, with the Yolias Pixel Helper); Set up (the base code and the
// standard events for purchases and leads); Settings (name, website, allowed
// and blocked domains). The name can also be changed in place (D-275).

export type EventsTab = "overview" | "test" | "setup" | "settings";
const TABS: EventsTab[] = ["overview", "test", "setup", "settings"];
const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v % 1 ? 2 : 0, minimumFractionDigits: v % 1 ? 2 : 0 }).format(v);
// Facebook's standard events for the two website objectives (purchase first, then leads).
const PURCHASE = ["Purchase", "InitiateCheckout", "AddPaymentInfo", "AddToCart", "AddToWishlist", "ViewContent", "Search", "CustomizeProduct", "StartTrial", "Subscribe", "Donate"] as const;
const LEADS = ["Lead", "CompleteRegistration", "Contact", "SubmitApplication", "Schedule", "FindLocation"] as const;
const VALUE_EVENTS = new Set(["Purchase", "InitiateCheckout", "AddPaymentInfo", "AddToCart", "AddToWishlist", "ViewContent", "StartTrial", "Subscribe", "Donate", "Lead", "CompleteRegistration"]);
const codeFor = (e: string) => (VALUE_EVENTS.has(e) && (e === "Purchase" || e === "StartTrial" || e === "Subscribe" || e === "Donate") ? `yolias("track", "${e}", { value: 49.00, currency: "USD" });` : `yolias("track", "${e}");`);

export function EventsManager({ testCode, active, data, tab, range, from, to, snippet, canManage, timeZone }: {
  testCode: string; active: boolean; data: PixelOverview; tab: EventsTab; range: RangePreset; from: string; to: string; snippet: string; canManage: boolean; timeZone: string | null;
}) {
  const { t, locale } = useI18n();
  const E = t.ag.rx.ev;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ name: data.pixel.name, website: data.pixel.websiteUrl ?? "", allowed: data.pixel.allowed.join(", "), blocked: data.pixel.blocked.join(", ") });
  // Rename in place, like Facebook's Events Manager (D-275): the pencil beside the name.
  const [renaming, setRenaming] = useState<string | null>(null);
  const rename = () => start(async () => {
    if (renaming == null) return;
    const r = await editPixelAction(data.pixel.id, { name: renaming });
    if (!r.ok) { toast(r.error, "error"); return; }
    setRenaming(null);
    setForm((f) => ({ ...f, name: renaming.trim() }));
    toast(r.message ?? E.saved);
    router.refresh();
  });
  const n = (v: number) => formatNumber(v, locale);
  const tz = timeZone ?? undefined;
  const go = (k: EventsTab) => { const p = new URLSearchParams(sp.toString()); if (k === "overview") p.delete("tab"); else p.set("tab", k); router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }); };
  const copy = (key: string, text: string) => { void navigator.clipboard?.writeText(text); setCopied(key); toast(E.copied); setTimeout(() => setCopied(null), 1500); };
  const peak = Math.max(1, ...data.series.map((d) => d.n));
  const code = (key: string, text: string) => (
    <div className="ev-code"><pre>{text}</pre><button type="button" className="sdr-btn sm" onClick={() => copy(key, text)}>{copied === key ? <Check /> : <Copy />}{E.copy}</button></div>
  );

  return (
    <div className="sdr-page ev">
      <nav className="cp-crumbs"><Link href="/events"><ChevronLeft className="flip-rtl" />{E.title}</Link><span aria-hidden>/</span><span dir="auto">{data.pixel.name}</span></nav>
      <header className="ev-head">
        <div className="ev-id">
          <span className="ev-ico"><Activity /></span>
          <div>
            {renaming != null ? (
              <form className="ev-title-edit" onSubmit={(e) => { e.preventDefault(); rename(); }}>
                <input className="form-input" autoFocus dir="auto" maxLength={80} aria-label={E.name} value={renaming} onChange={(e) => setRenaming(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setRenaming(null); }} />
                <button type="submit" className="sdr-btn primary sm" disabled={pending || !renaming.trim()}><Check />{E.save}</button>
                <button type="button" className="sdr-icon-btn" aria-label={E.cancel} onClick={() => setRenaming(null)}><X /></button>
              </form>
            ) : (
              <div className="ev-title-edit">
                <h2 dir="auto">{data.pixel.name}</h2>
                {canManage && <button type="button" className="sdr-icon-btn ev-rename" aria-label={E.rename} title={E.rename} onClick={() => setRenaming(data.pixel.name)}><Pencil /></button>}
              </div>
            )}
            <p><span className={`ev-dot${active ? " on" : ""}`} />{active ? E.active : data.pixel.lastEventAt ? E.quiet : E.notInstalled}<span dir="ltr">· ID {data.pixel.publicId}</span></p>
          </div>
        </div>
        <div className="ev-actions">
          <button type="button" className="sdr-btn" disabled={pending} onClick={() => start(() => router.refresh())}><RefreshCw className={pending ? "spin" : ""} />{E.refresh}</button>
          {tab === "overview" && <DateRange range={range} from={from} to={to} defaultRange="30d" />}
        </div>
      </header>

      <nav className="cp-tabs" role="tablist">
        {TABS.map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => go(k)}>{E.tabs[k]}</button>)}
      </nav>

      {tab === "overview" && (
        <>
          {!data.pixel.lastEventAt && (
            <div className="ev-setup-note"><strong>{E.notInstalled}</strong><span>{E.installLine}</span><button type="button" className="sdr-btn primary sm" onClick={() => go("setup")}>{E.setupCta}</button></div>
          )}
          <section className="cp-card wide">
            <div className="cp-card-head"><h3>{E.allEvents}</h3><strong className="ev-total">{n(data.total)}</strong></div>
            <div className="cp-bars ev-bars" role="img" aria-label={E.allEvents}>
              {data.series.map((d) => <div key={d.day} className="cp-bar" title={`${d.day}: ${d.n}`}><span className="m" style={{ height: `${(d.n / peak) * 100}%` }} /><small>{d.day.slice(8)}</small></div>)}
            </div>
          </section>
          <div className="cm-table-wrap">
            <table className="cm-table">
              <thead><tr><th className="cm-name">{E.colEvent}</th><th className="num">{E.colTotal}</th><th className="num">{E.colCredited}</th><th className="num">{E.colValue}</th><th>{E.colLast}</th></tr></thead>
              <tbody>
                {!data.events.length && <tr><td colSpan={5} className="cm-none">{E.none}</td></tr>}
                {data.events.map((e) => (
                  <tr key={e.name}>
                    <td className="cm-name"><span className="cm-name-cell"><strong dir="ltr">{e.name}</strong><small>{E.kinds[e.name as keyof typeof E.kinds] ?? E.custom}</small></span></td>
                    <td className="num">{n(e.total)}</td>
                    <td className="num">{n(e.credited)}</td>
                    <td className="num">{e.value ? usd(e.value) : "–"}</td>
                    <td>{formatDateTime(e.last, locale, tz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "test" && <TestEvents pixelId={data.pixel.id} code={testCode} website={data.pixel.websiteUrl ?? ""} timeZone={tz} />}

      {tab === "setup" && (
        <div className="ev-setup">
          <section className="cp-card">
            <h3>{E.step1}</h3>
            <p className="ws-hint">{E.step1Line}</p>
            {code("base", snippet)}
            <p className="ws-hint">{E.matchingLine}</p>
            {code("match", `yolias("init", "${data.pixel.publicId}", { em: "customer@example.com" });`)}
          </section>
          <section className="cp-card">
            <h3>{E.standard}</h3>
            <p className="ws-hint">{E.standardLine}</p>
            {([["purchase", PURCHASE], ["leads", LEADS]] as const).map(([group, list]) => (
              <div key={group} className="ev-group">
                <h4>{E.groups[group]}</h4>
                <div className="cm-table-wrap">
                  <table className="cm-table ev-std">
                    <thead><tr><th className="cm-name">{E.colEvent}</th><th>{E.colWhen}</th><th>{E.colCode}</th></tr></thead>
                    <tbody>
                      {list.map((e) => (
                        <tr key={e}>
                          <td className="cm-name"><span className="cm-name-cell"><strong dir="ltr">{e}</strong><small>{E.kinds[e as keyof typeof E.kinds]}</small></span></td>
                          <td className="ev-when">{E.when[e as keyof typeof E.when]}</td>
                          <td className="ev-snip">{code(`std-${e}`, codeFor(e))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <p className="ws-hint">{E.customLine}</p>
            {code("custom", `yolias("trackCustom", "QuoteRequested");`)}
          </section>
        </div>
      )}

      {tab === "settings" && (
        <section className="cp-card ev-settings">
          <label className="ws-field"><span className="ws-label">{E.name}</span><input className="form-input" dir="auto" maxLength={80} value={form.name} disabled={!canManage} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="ws-field"><span className="ws-label">{E.site}</span><input className="form-input" dir="ltr" inputMode="url" maxLength={300} placeholder={E.sitePh} value={form.website} disabled={!canManage} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
          <label className="ws-field"><span className="ws-label">{E.domains}</span><input className="form-input" dir="ltr" placeholder="example.com, shop.example.com" value={form.allowed} disabled={!canManage} onChange={(e) => setForm({ ...form, allowed: e.target.value })} /><span className="ws-hint">{E.domainsHint}</span></label>
          <label className="ws-field"><span className="ws-label">{E.blocked}</span><input className="form-input" dir="ltr" placeholder="staging.example.com" value={form.blocked} disabled={!canManage} onChange={(e) => setForm({ ...form, blocked: e.target.value })} /><span className="ws-hint">{E.blockedHint}</span></label>
          {canManage && <div><button type="button" className="sdr-btn primary" disabled={pending} onClick={() => start(async () => { const r = await savePixelSettings(data.pixel.id, form); if (r.ok) { toast(r.message ?? E.saved); router.refresh(); } else toast(r.error, "error"); })}>{E.save}</button></div>}
        </section>
      )}
    </div>
  );
}

/** Test events, like Facebook's: open the website with a test code; events sent from that browser show here as they arrive. */
function TestEvents({ pixelId, code, website, timeZone }: { pixelId: string; code: string; website: string; timeZone?: string }) {
  const { t, locale } = useI18n();
  const E = t.ag.rx.ev;
  const [url, setUrl] = useState(website);
  const [events, setEvents] = useState<TestEvent[]>([]);
  const [listening, setListening] = useState(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const link = useMemo(() => {
    try { const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`); u.searchParams.set("yolias_test", code); return u.href; } catch { return null; }
  }, [url, code]);
  useEffect(() => {
    if (!listening) return;
    const poll = () => { void pollTestEvents(pixelId, code).then(setEvents).catch(() => {}); };
    poll();
    timer.current = setInterval(poll, 3000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [listening, pixelId, code]);
  return (
    <div className="ev-test">
      <section className="cp-card">
        <h3>{E.testTitle}</h3>
        <p className="ws-hint">{E.testLine}</p>
        <div className="ev-test-row">
          <input className="form-input" dir="ltr" type="url" inputMode="url" placeholder="https://www.example.com" value={url} onChange={(e) => setUrl(e.target.value)} aria-label={E.siteUrl} />
          <a className={`sdr-btn primary${link ? "" : " disabled"}`} href={link ?? undefined} target="_blank" rel="noopener" aria-disabled={!link} onClick={(e) => { if (!link) e.preventDefault(); else setListening(true); }}><ExternalLink />{E.openSite}</a>
        </div>
        <p className="ws-hint">{fmt(E.testCode, { code })}</p>
      </section>
      <section className="cp-card">
        <div className="cp-card-head"><h3>{E.received}</h3>{listening && <span className="ev-live"><span className="ev-dot on" />{E.listening}</span>}</div>
        {events.length ? (
          <ul className="ev-list">
            {events.map((r) => (
              <li key={r.id}>
                <button type="button" className="ev-row" aria-expanded={openRow === r.id} onClick={() => setOpenRow(openRow === r.id ? null : r.id)}>
                  <CheckCircle2 className="ev-ok" /><strong dir="ltr">{r.event}</strong>
                  {r.value != null && <span className="ev-val" dir="ltr">{r.currency === "USD" || !r.currency ? usd(r.value) : `${r.value} ${r.currency}`}</span>}
                  <span className="ev-url" dir="ltr">{r.url ?? ""}</span>
                  <small>{formatDateTime(r.at, locale, timeZone)}</small>
                </button>
                {openRow === r.id && <pre className="ev-detail" dir="ltr">{JSON.stringify({ event: r.event, value: r.value, currency: r.currency, event_id: r.eventId, url: r.url, received: r.at }, null, 2)}</pre>}
              </li>
            ))}
          </ul>
        ) : <p className="ws-hint">{listening ? E.waiting : E.testEmpty}</p>}
      </section>
      <section className="cp-card ev-helper">
        <div><h3>Yolias Pixel Helper</h3><p className="ws-hint">{E.helperLine}</p></div>
        <Link className="sdr-btn" href="/integrations/pixel-helper">{E.helperGet}</Link>
      </section>
    </div>
  );
}
