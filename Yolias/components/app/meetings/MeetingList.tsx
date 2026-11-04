"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Sparkles, UserX, Video, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { LOST_REASONS } from "@/components/app/ws/bits";
import { meetingBriefAction, setMeetingQualified, setMeetingStatus, setOutcome } from "@/app/(app)/meetings/actions";
import type { LeadStage, MeetingStatus } from "@/types/database";

export interface MeetingItem {
  id: string; lead_id: string; title: string; starts_at: string; ends_at: string | null; url: string | null; location: string | null;
  status: MeetingStatus; source: "manual" | "booking" | "agent"; guest_name: string | null; guest_email: string | null; guest_note: string | null;
  lead: { name: string; company_name: string | null; stage: LeadStage } | null;
  /** D-270: the campaign it came from and whether the member judged it qualified. */
  campaign: { id: string; name: string } | null; qualified: boolean | null;
  /** D-274: the brief Yolias prepared before the meeting. */
  brief?: string | null;
}
type Show = "all" | "upcoming" | "past" | "no_show" | "canceled" | "qualified" | "unqualified";

// Bookings (D-267, D-268): upcoming first, then the last 60 days. Before a
// meeting: join, a brief from Yolias, cancel. After it: what came of it
// (became a customer, didn't buy and why, no-show), the one place it's asked.
// D-274 (owner): no "Add a meeting" or "Copy your link" here; Yolias books, and the link is on the Booking page tab.
export function MeetingList({ upcoming, past, timeZone }: { upcoming: MeetingItem[]; past: MeetingItem[]; timeZone: string | null }) {
  const { t, locale } = useI18n();
  const m = t.meetings;
  const o = m.outcome;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [briefs, setBriefs] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Show>("all");
  const [values, setValues] = useState<Record<string, string>>({});
  const f = t.camp.meet;
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { ...opts, timeZone: timeZone ?? undefined }).format(new Date(iso));
  const done = (r: { ok: boolean; error?: string }) => { if (!r.ok) toast(r.error ?? t.ws.common.error, "error"); else { toast(m.saved); router.refresh(); } };
  const status = (id: string, s: MeetingStatus) => {
    if (s === "canceled" && !window.confirm(m.cancelConfirm)) return;
    start(async () => done(await setMeetingStatus(id, s)));
  };
  const brief = (id: string) => start(async () => {
    const r = await meetingBriefAction(id);
    if (r.ok) setBriefs((b) => ({ ...b, [id]: r.brief })); else toast(r.error, "error");
  });
  const decided = (x: MeetingItem) => x.lead?.stage === "closed" || x.lead?.stage === "lost";

  const card = (x: MeetingItem, isPast: boolean) => (
    <li key={x.id} className={`meet-item${x.status === "canceled" || x.status === "no_show" ? " muted" : ""}`}>
      <div className="meet-when">
        <strong>{fmt(x.starts_at, { weekday: "short", day: "numeric", month: "short" })}</strong>
        <span><bdi>{fmt(x.starts_at, { hour: "numeric", minute: "2-digit" })}</bdi>{x.ends_at && <> – <bdi>{fmt(x.ends_at, { hour: "numeric", minute: "2-digit" })}</bdi></>}</span>
      </div>
      <div className="meet-who">
        <Link href={`/inbox?lead=${x.lead_id}`} className="meet-name" dir="auto">{x.guest_name || x.lead?.name || x.title}</Link>
        <span className="meet-sub" dir="auto">{[x.lead?.company_name, x.guest_email].filter(Boolean).join(" · ") || x.title}</span>
        {x.guest_note && <span className="meet-sub" dir="auto">{m.guestNote}: {x.guest_note}</span>}
        <span className="meet-tags">
          <span className="meet-tag">{m.source[x.source]}</span>
          {x.status !== "scheduled" && <span className="meet-tag">{m.status[x.status]}</span>}
          {decided(x) && <span className="meet-tag">{x.lead?.stage === "closed" ? o.won : o.lost}</span>}
          {x.qualified != null && <span className="meet-tag">{x.qualified ? f.qualified : f.unqualified}</span>}
          {x.campaign && <Link className="meet-tag" href={`/campaigns/${x.campaign.id}`} dir="auto">{f.campaign}: {x.campaign.name}</Link>}
          {x.location && !x.url && <span className="meet-sub" dir="auto">{x.location}</span>}
        </span>
        {(briefs[x.id] ?? x.brief) && <details className="meet-brief-box" open={Boolean(briefs[x.id])}><summary>{t.ag.rx.meet.brief}</summary><p className="meet-brief" dir="auto">{briefs[x.id] ?? x.brief}</p></details>}
      </div>
      <div className="meet-actions">
        {!isPast && x.status === "scheduled" && (<>
          {x.url && <a className="sdr-btn sm" href={x.url} target="_blank" rel="noreferrer"><Video />{m.join}</a>}
          {!x.brief && !briefs[x.id] && <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => brief(x.id)}><Sparkles />{o.prep}</button>}
          <button type="button" className="sdr-icon-btn bordered" title={m.cancel} aria-label={m.cancel} disabled={pending} onClick={() => status(x.id, "canceled")}><X /></button>
        </>)}
        {isPast && x.status === "scheduled" && (
          <span className="meet-q"><span>{t.ag.rx.meet.happened}</span>
            <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => status(x.id, "completed")}><CalendarCheck />{t.ag.rx.meet.held}</button>
            <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => status(x.id, "no_show")}><UserX />{m.noShow}</button>
          </span>
        )}
        {isPast && x.status === "completed" && x.qualified == null && (
          <span className="meet-q"><span>{f.qualifiedQ}</span>
            <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => start(async () => done(await setMeetingQualified(x.id, true)))}>{f.yes}</button>
            <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => start(async () => done(await setMeetingQualified(x.id, false)))}>{f.no}</button>
          </span>
        )}
        {isPast && x.status === "completed" && !decided(x) && (<>
          <input className="sdr-input sm meet-value" type="number" min={0} inputMode="decimal" placeholder={f.value} title={f.valueHint} aria-label={f.value} value={values[x.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [x.id]: e.target.value }))} />
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => start(async () => done(await setOutcome(x.lead_id, true, null, x.id, values[x.id] ? Number(values[x.id]) : null)))}>{o.won}</button>
          <select className="sdr-input sm" disabled={pending} value="" aria-label={o.lost} onChange={(e) => { const r = e.target.value; if (r) start(async () => done(await setOutcome(x.lead_id, false, r, x.id))); }}>
            <option value="">{o.lost}</option>
            {LOST_REASONS.map((r) => <option key={r} value={r}>{t.ws.crm.lostReasons[r]}</option>)}
          </select>
        </>)}
      </div>
    </li>
  );

  // No meetings yet (owner, 2026-10-31): only the sentence, nothing else.
  if (!upcoming.length && !past.length) return <section className="sdr-panel meet-list"><p className="meet-muted meet-empty">{m.empty}</p></section>;
  return (
    <section className="sdr-panel meet-list">
      {(upcoming.length > 0 || past.length > 0) && (
        <div className="sdr-seg meet-filter" role="tablist" aria-label={f.filter}>
          {(["all", "upcoming", "past", "no_show", "canceled", "qualified", "unqualified"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={show === k} className={show === k ? "active" : ""} onClick={() => setShow(k)}>
              {{ all: f.all, upcoming: f.upcoming, past: f.past, no_show: f.noShow, canceled: f.canceled, qualified: f.qualified, unqualified: f.unqualified }[k]}
            </button>
          ))}
        </div>
      )}
      {(() => {
        const keep = (x: MeetingItem) => show === "all" || (show === "past" ? x.status === "completed" : show === "no_show" ? x.status === "no_show" : show === "canceled" ? x.status === "canceled" : show === "qualified" ? x.qualified === true : show === "unqualified" ? x.qualified === false : true);
        const up = show === "all" || show === "upcoming" ? upcoming : [];
        const pa = show === "upcoming" ? [] : past.filter(keep);
        return (<>
          {up.length > 0 && (<><h3 className="meet-group">{m.upcoming}</h3><ul>{up.map((x) => card(x, false))}</ul></>)}
          {pa.length > 0 && (<><h3 className="meet-group">{m.past}</h3><ul>{pa.map((x) => card(x, true))}</ul></>)}
        </>);
      })()}
    </section>
  );
}
