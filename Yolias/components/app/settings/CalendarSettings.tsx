"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { calendarState, disconnectCalendar } from "@/app/(app)/settings/calendar-actions";

// Google Calendar and Meet (D-267, in Integrations since D-268): connect,
// see which account, disconnect. The booking page only uses it.
export function CalendarSettings({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  const { t } = useI18n();
  const p = t.meetings.page;
  const [state, setState] = useState<Awaited<ReturnType<typeof calendarState>> | null>(null);
  const [pending, start] = useTransition();
  const load = () => calendarState().then(setState).catch(() => setState(null));
  useEffect(() => { void load(); }, []);
  const notice = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("calendar") : null;
  const c = state?.connection;
  return (
    <div className="meet-settings">
      <button type="button" className="integration-back" onClick={onBack}><ChevronLeft className="flip-rtl" />{backLabel}</button>
      <section className="meet-box">
        <h3>{p.google}</h3>
        <p className="meet-muted">{p.googleLead}</p>
        <ul className="meet-points">{p.googlePoints.map((x) => <li key={x}><Check size={14} />{x}</li>)}</ul>
        {notice && p.calendar[notice as keyof typeof p.calendar] && <p className={notice === "connected" ? "meet-ok" : "meet-error"}>{p.calendar[notice as keyof typeof p.calendar]}</p>}
        {!state ? null : c ? (
          <div className="meet-linkrow">
            <span>{fmt(p.connectedAs, { email: c.email ?? "Google" })}</span>
            {c.status === "error" && <><span className="meet-error">{c.error}</span><a className="sdr-btn sm" href="/api/calendar/google/start">{p.reconnect}</a></>}
            <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => start(async () => { await disconnectCalendar(); await load(); })}>{p.disconnect}</button>
          </div>
        ) : state.available ? <a className="btn-primary meet-connect" href="/api/calendar/google/start">{p.connect}</a> : <p className="meet-muted">{p.notConfigured}</p>}
      </section>
    </div>
  );
}
