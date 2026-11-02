"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, Check, Copy, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { DateRange } from "@/components/app/campaigns/DateRange";
import { savePixelSettings } from "@/app/(app)/events/actions";
import type { RangePreset } from "@/lib/campaigns/metrics";
import type { EventsOverview } from "@/services/events";

// Events Manager (owner, 2026-11-02, D-274), laid out like Facebook's: the
// pixel's name, id and status on top; Overview (events by day and by name),
// Test events (the latest events as they arrive), Setup (the code for the
// website and for each event) and Settings (name, allowed domains).

export type EventsTab = "overview" | "test" | "setup" | "settings";
const TABS: EventsTab[] = ["overview", "test", "setup", "settings"];
const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v % 1 ? 2 : 0, minimumFractionDigits: v % 1 ? 2 : 0 }).format(v);

export function EventsManager({ active, data, tab, range, from, to, snippet, canManage, timeZone }: {
  active: boolean; data: EventsOverview; tab: EventsTab; range: RangePreset; from: string; to: string; snippet: string; canManage: boolean; timeZone: string | null;
}) {
  const { t, locale } = useI18n();
  const E = t.ag.rx.ev;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ name: data.pixel.name, domains: data.pixel.domains.join(", ") });
  const n = (v: number) => formatNumber(v, locale);
  const go = (k: EventsTab) => { const p = new URLSearchParams(sp.toString()); if (k === "overview") p.delete("tab"); else p.set("tab", k); router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }); };
  const copy = (key: string, text: string) => { void navigator.clipboard?.writeText(text); setCopied(key); toast(E.copied); setTimeout(() => setCopied(null), 1500); };
  const peak = Math.max(1, ...data.series.map((d) => d.n));
  const code = (key: string, text: string) => (
    <div className="ev-code"><pre dir="ltr">{text}</pre><button type="button" className="sdr-btn sm" onClick={() => copy(key, text)}>{copied === key ? <Check /> : <Copy />}{E.copy}</button></div>
  );

  return (
    <div className="sdr-page ev">
      <header className="ev-head">
        <div className="ev-id">
          <span className="ev-ico"><Activity /></span>
          <div>
            <h2 dir="auto">{data.pixel.name}</h2>
            <p dir="ltr"><span className={`ev-dot${active ? " on" : ""}`} />{active ? E.active : data.pixel.lastEventAt ? E.quiet : E.notInstalled} · ID {data.pixel.id}</p>
          </div>
        </div>
        <div className="ev-actions">
          <button type="button" className="sdr-btn" disabled={pending} onClick={() => start(() => router.refresh())}><RefreshCw className={pending ? "spin" : ""} />{E.refresh}</button>
          <DateRange range={range} from={from} to={to} defaultRange="30d" />
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
                    <td>{formatDateTime(e.last, locale, timeZone ?? undefined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "test" && (
        <section className="cp-card">
          <div className="cp-card-head"><h3>{E.testTitle}</h3><button type="button" className="sdr-btn sm" disabled={pending} onClick={() => start(() => router.refresh())}><RefreshCw className={pending ? "spin" : ""} />{E.refresh}</button></div>
          <p className="ws-hint">{E.testLine}</p>
          {data.recent.length ? (
            <ul className="ev-list">
              {data.recent.map((r) => (
                <li key={r.id}>
                  <strong dir="ltr">{r.event}</strong>
                  {r.value != null && <span className="ev-val" dir="ltr">{r.currency === "USD" || !r.currency ? usd(r.value) : `${r.value} ${r.currency}`}</span>}
                  {r.campaign ? <Link href={`/outreach/${r.campaign.id}`} className="sdr-badge nodot green" dir="auto">{r.campaign.name}</Link> : <span className="sdr-badge nodot gray">{E.notCredited}</span>}
                  <span className="ev-url" dir="ltr">{r.url ?? ""}</span>
                  <small>{formatDateTime(r.at, locale, timeZone ?? undefined)}</small>
                </li>
              ))}
            </ul>
          ) : <p className="ws-hint">{E.none}</p>}
        </section>
      )}

      {tab === "setup" && (
        <div className="ev-setup">
          <section className="cp-card">
            <h3>{E.step1}</h3>
            <p className="ws-hint">{E.step1Line}</p>
            {code("base", snippet)}
          </section>
          <section className="cp-card">
            <h3>{E.step2}</h3>
            <p className="ws-hint">{E.step2Line}</p>
            <dl className="ev-snips">
              <dt>Purchase</dt><dd>{code("purchase", `yolias("track", "Purchase", { value: 99.0, currency: "USD" });`)}</dd>
              <dt>InitiateCheckout</dt><dd>{code("checkout", `yolias("track", "InitiateCheckout");`)}</dd>
              <dt>Lead</dt><dd>{code("lead", `yolias("track", "Lead");`)}</dd>
              <dt>{E.custom}</dt><dd>{code("custom", `yolias("trackCustom", "QuoteRequested");`)}</dd>
            </dl>
          </section>
          <section className="cp-card">
            <h3>{E.step3}</h3>
            <p className="ws-hint">{fmt(E.step3Line, { param: "yc" })}</p>
            <button type="button" className="sdr-btn" onClick={() => go("test")}>{E.tabs.test}</button>
          </section>
        </div>
      )}

      {tab === "settings" && (
        <section className="cp-card ev-settings">
          <label className="ws-field"><span className="ws-label">{E.name}</span><input className="form-input" dir="auto" maxLength={80} value={form.name} disabled={!canManage} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="ws-field"><span className="ws-label">{E.domains}</span><input className="form-input" dir="ltr" placeholder="example.com, shop.example.com" value={form.domains} disabled={!canManage} onChange={(e) => setForm({ ...form, domains: e.target.value })} /><span className="ws-hint">{E.domainsHint}</span></label>
          {canManage && <div><button type="button" className="sdr-btn primary" disabled={pending} onClick={() => start(async () => { const r = await savePixelSettings(form); if (r.ok) { toast(r.message ?? E.saved); router.refresh(); } else toast(r.error, "error"); })}>{E.save}</button></div>}
        </section>
      )}
    </div>
  );
}
