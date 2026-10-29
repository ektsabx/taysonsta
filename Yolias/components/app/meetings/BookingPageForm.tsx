"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Plus, Trash2, Video } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { DAYS } from "@/lib/meetings/availability";
import { disconnectCalendar, saveBookingPage } from "@/app/(app)/meetings/actions";
import type { BookingPageRow, CalendarConnectionRow } from "@/types/database";

// Booking page settings (owner's layout, 2026-10-30, D-267): the link, Google
// Calendar and Meet, then the page itself and its weekly hours. One Save.
const DURATIONS = [15, 20, 30, 45, 60, 90];
const BUFFERS = [0, 5, 10, 15, 30];
const NOTICE = [0, 1, 2, 4, 12, 24, 48];
const WINDOW = [7, 14, 21, 30, 60];
const ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function BookingPageForm({ page, link, calendar, googleReady, notice, zones }: {
  page: BookingPageRow; link: string; calendar: Pick<CalendarConnectionRow, "email" | "status" | "error"> | null; googleReady: boolean; notice: string | null;
  /** Time zones with their labels, from the server (labels depend on the date and the ICU data). */
  zones: { value: string; label: string }[];
}) {
  const { t } = useI18n();
  const m = t.meetings;
  const p = m.page;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    enabled: page.enabled, slug: page.slug, title: page.title, location: page.location ?? "", description: page.description ?? "",
    duration_min: page.duration_min, timezone: page.timezone, buffer_min: page.buffer_min, min_notice_hours: page.min_notice_hours, window_days: page.window_days,
    hours: Object.fromEntries(DAYS.map((d) => [d, page.hours[d] ?? []])) as BookingPageRow["hours"],
  });
  const [copied, setCopied] = useState(false);
  const base = link.slice(0, link.length - page.slug.length);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));
  const setRange = (d: (typeof DAYS)[number], i: number, which: 0 | 1, value: string) => set("hours", { ...v.hours, [d]: v.hours[d].map((r, j) => (j === i ? (which ? [r[0], value] : [value, r[1]]) as [string, string] : r)) });
  const save = () => start(async () => {
    const r = await saveBookingPage(v);
    if (!r.ok) toast(r.error, "error"); else { toast(m.saved); router.refresh(); }
  });
  const select = (k: "duration_min" | "buffer_min" | "min_notice_hours" | "window_days", opts: number[], label: (n: number) => string) => (
    <select className="form-input" value={v[k]} onChange={(e) => set(k, Number(e.target.value))}>
      {[...new Set([...opts, v[k]])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{label(n)}</option>)}
    </select>
  );
  const minutes = (n: number) => fmt(p.minutes, { n: String(n) });

  return (
    <div className="meet-settings">
      <p className="meet-intro">{p.intro}</p>

      <section className="meet-box">
        <h3>{p.link}</h3>
        <div className="meet-linkrow">
          <code dir="ltr">{link}</code>
          <button type="button" className="sdr-btn sm" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check /> : <Copy />}{copied ? p.copied : p.copy}</button>
          <a className="sdr-btn sm" href={link} target="_blank" rel="noreferrer"><ExternalLink />{p.open}</a>
        </div>
      </section>

      <section className="meet-box">
        <h3><Video size={16} /> {p.google}</h3>
        <p className="meet-muted">{p.googleLead}</p>
        <ul className="meet-points">{p.googlePoints.map((x) => <li key={x}><Check size={14} />{x}</li>)}</ul>
        {notice && p.calendar[notice as keyof typeof p.calendar] && <p className={notice === "connected" ? "meet-ok" : "meet-error"}>{p.calendar[notice as keyof typeof p.calendar]}</p>}
        {calendar && calendar.status !== "disconnected" ? (
          <div className="meet-linkrow">
            <span>{fmt(p.connectedAs, { email: calendar.email ?? "Google" })}</span>
            {calendar.status === "error" && <><span className="meet-error">{calendar.error}</span><a className="sdr-btn sm" href="/api/calendar/google/start">{p.reconnect}</a></>}
            <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => start(async () => { await disconnectCalendar(); router.refresh(); })}>{p.disconnect}</button>
          </div>
        ) : googleReady ? <a className="btn-primary meet-connect" href="/api/calendar/google/start">{p.connect}</a> : <p className="meet-muted">{p.notConfigured}</p>}
      </section>

      <section className="meet-box">
        <label className="meet-switch"><input type="checkbox" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} /> {p.taking}</label>
        <div className="meet-grid">
          <label>{p.address}<span className="meet-slug" dir="ltr"><span>{base.replace(/^https?:\/\//, "")}</span><input className="form-input" value={v.slug} maxLength={40} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></span></label>
          <label>{p.name}<input className="form-input" value={v.title} maxLength={120} onChange={(e) => set("title", e.target.value)} dir="auto" /></label>
          <label className="wide">{p.location}<input className="form-input" value={v.location} maxLength={300} onChange={(e) => set("location", e.target.value)} dir="auto" /><span className="meet-hint">{p.locationHint}</span></label>
          <label className="wide">{p.line}<input className="form-input" value={v.description} maxLength={500} placeholder={p.lineHint} onChange={(e) => set("description", e.target.value)} dir="auto" /></label>
          <label>{p.duration}{select("duration_min", DURATIONS, minutes)}</label>
          <label>{p.timezone}<select className="form-input" value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>{zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}</select></label>
          <label>{p.buffer}{select("buffer_min", BUFFERS, minutes)}</label>
          <label>{p.notice}{select("min_notice_hours", NOTICE, (n) => fmt(p.hoursN, { n: String(n) }))}</label>
          <label>{p.window}{select("window_days", WINDOW, (n) => fmt(p.daysN, { n: String(n) }))}</label>
        </div>

        <h3>{p.hours}</h3>
        <div className="meet-week">
          {ORDER.map((d) => (
            <div key={d} className="meet-day">
              <span className="meet-dayname">{m.days[d]}</span>
              <div className="meet-ranges">
                {v.hours[d].length ? v.hours[d].map((r, i) => (
                  <span key={i} className="meet-range" dir="ltr">
                    <input type="time" className="form-input" value={r[0]} onChange={(e) => setRange(d, i, 0, e.target.value)} />
                    <span>→</span>
                    <input type="time" className="form-input" value={r[1]} onChange={(e) => setRange(d, i, 1, e.target.value)} />
                    <button type="button" className="sdr-icon-btn" aria-label={p.unavailable} onClick={() => set("hours", { ...v.hours, [d]: v.hours[d].filter((_, j) => j !== i) })}><Trash2 /></button>
                  </span>
                )) : <span className="meet-muted">{p.unavailable}</span>}
              </div>
              {v.hours[d].length < 3 && <button type="button" className="sdr-icon-btn" aria-label={p.addRange} title={p.addRange} onClick={() => set("hours", { ...v.hours, [d]: [...v.hours[d], v.hours[d].length ? ["14:00", "17:00"] : ["10:00", "17:00"]] })}><Plus /></button>}
            </div>
          ))}
        </div>
        <div><button type="button" className="btn-primary" disabled={pending} onClick={save}>{p.save}</button></div>
      </section>
    </div>
  );
}
