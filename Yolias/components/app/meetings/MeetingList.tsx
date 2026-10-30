"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Copy, Sparkles, UserX, Video, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { LOST_REASONS } from "@/components/app/ws/bits";
import { addMeeting, meetingBriefAction, setMeetingStatus, setOutcome } from "@/app/(app)/meetings/actions";
import type { LeadStage, MeetingStatus } from "@/types/database";

export interface MeetingItem {
  id: string; lead_id: string; title: string; starts_at: string; ends_at: string | null; url: string | null; location: string | null;
  status: MeetingStatus; source: "manual" | "booking" | "agent"; guest_name: string | null; guest_email: string | null; guest_note: string | null;
  lead: { name: string; company_name: string | null; stage: LeadStage } | null;
}

// Bookings (D-267, D-268): upcoming first, then the last 60 days. Before a
// meeting: join, a brief from Yolias, cancel. After it: what came of it
// (became a customer, didn't buy and why, no-show), the one place it's asked.
export function MeetingList({ upcoming, past, timeZone, bookingLink, people, duration }: {
  upcoming: MeetingItem[]; past: MeetingItem[]; timeZone: string | null; bookingLink: string; people: { id: string; name: string }[]; duration: number;
}) {
  const { t, locale } = useI18n();
  const m = t.meetings;
  const o = m.outcome;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [briefs, setBriefs] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
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
          {x.location && !x.url && <span className="meet-sub" dir="auto">{x.location}</span>}
        </span>
        {briefs[x.id] && <p className="meet-brief" dir="auto">{briefs[x.id]}</p>}
      </div>
      <div className="meet-actions">
        {!isPast && x.status === "scheduled" && (<>
          {x.url && <a className="sdr-btn sm" href={x.url} target="_blank" rel="noreferrer"><Video />{m.join}</a>}
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => brief(x.id)}><Sparkles />{o.prep}</button>
          <button type="button" className="sdr-icon-btn bordered" title={m.cancel} aria-label={m.cancel} disabled={pending} onClick={() => status(x.id, "canceled")}><X /></button>
        </>)}
        {isPast && (x.status === "scheduled" || x.status === "completed") && !decided(x) && (<>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => start(async () => done(await setOutcome(x.lead_id, true, null, x.id)))}>{o.won}</button>
          <select className="sdr-input sm" disabled={pending} value="" aria-label={o.lost} onChange={(e) => { const r = e.target.value; if (r) start(async () => done(await setOutcome(x.lead_id, false, r, x.id))); }}>
            <option value="">{o.lost}</option>
            {LOST_REASONS.map((r) => <option key={r} value={r}>{t.ws.crm.lostReasons[r]}</option>)}
          </select>
          {x.status === "scheduled" && <button type="button" className="sdr-icon-btn bordered" title={m.noShow} aria-label={m.noShow} disabled={pending} onClick={() => status(x.id, "no_show")}><UserX /></button>}
        </>)}
      </div>
    </li>
  );

  return (
    <section className="sdr-panel meet-list">
      <div className="meet-list-head">
        <button type="button" className="sdr-btn" onClick={() => setAdding(true)} disabled={!people.length}><CalendarPlus />{o.add}</button>
        <button type="button" className="sdr-btn" onClick={() => { void navigator.clipboard?.writeText(bookingLink); toast(m.page.copied); }}><Copy />{m.page.copy} {m.page.link}</button>
      </div>
      {!upcoming.length && !past.length && <p className="meet-muted">{m.empty}</p>}
      {upcoming.length > 0 && (<><h3 className="meet-group">{m.upcoming}</h3><ul>{upcoming.map((x) => card(x, false))}</ul></>)}
      {past.length > 0 && (<><h3 className="meet-group">{m.past}</h3><ul>{past.map((x) => card(x, true))}</ul></>)}
      {adding && <AddMeeting people={people} duration={duration} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); toast(m.saved); router.refresh(); }} />}
    </section>
  );
}

function AddMeeting({ people, duration, onClose, onSaved }: { people: { id: string; name: string }[]; duration: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const o = t.meetings.outcome;
  const toast = useToast();
  const [v, setV] = useState({ leadId: "", start: "", minutes: duration, place: "" });
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await addMeeting({ leadId: v.leadId, start: new Date(v.start).toISOString(), minutes: v.minutes, place: v.place });
    if (r.ok) onSaved(); else toast(r.error, "error");
  });
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={o.add} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card meet-form" style={{ maxWidth: 440 }}>
        <h3 style={{ margin: 0 }}>{o.add}</h3>
        <label>{o.who}<select className="form-input" value={v.leadId} onChange={(e) => setV({ ...v, leadId: e.target.value })}><option value="">{o.pick}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>{o.when}<input className="form-input" type="datetime-local" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></label>
        <label>{o.length}<input className="form-input" type="number" min={10} max={480} value={v.minutes} onChange={(e) => setV({ ...v, minutes: Number(e.target.value) || duration })} /></label>
        <label>{o.place}<input className="form-input" value={v.place} maxLength={300} onChange={(e) => setV({ ...v, place: e.target.value })} dir="auto" /></label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="sdr-btn" onClick={onClose}>{t.ws.common.cancel}</button>
          <button type="button" className="btn-primary" disabled={pending || !v.leadId || !v.start} onClick={save}>{t.meetings.page.save}</button>
        </div>
      </div>
    </div>
  );
}
