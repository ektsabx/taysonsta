"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, UserX, Video, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { setMeetingStatus } from "@/app/(app)/meetings/actions";
import type { MeetingStatus } from "@/types/database";

export interface MeetingItem {
  id: string; lead_id: string; title: string; starts_at: string; ends_at: string | null; url: string | null; location: string | null;
  status: MeetingStatus; source: "manual" | "booking" | "agent"; guest_name: string | null; guest_email: string | null; guest_note: string | null;
  lead: { name: string; company_name: string | null } | null;
}

// Bookings (D-267): upcoming first, then the last 60 days. Each meeting opens
// its customer; the host marks it done or no-show, or cancels it.
export function MeetingList({ upcoming, past, timeZone, bookingLink }: { upcoming: MeetingItem[]; past: MeetingItem[]; timeZone: string | null; bookingLink: string }) {
  const { t, locale } = useI18n();
  const m = t.meetings;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { ...o, timeZone: timeZone ?? undefined }).format(new Date(iso));
  const act = (id: string, status: MeetingStatus) => {
    if (status === "canceled" && !window.confirm(m.cancelConfirm)) return;
    start(async () => {
      const r = await setMeetingStatus(id, status);
      if (!r.ok) toast(r.error, "error"); else { toast(m.saved); router.refresh(); }
    });
  };
  if (!upcoming.length && !past.length) {
    return (
      <div className="empty-next">
        <p>{m.empty}</p>
        <button type="button" className="btn-primary" onClick={() => { void navigator.clipboard?.writeText(bookingLink); toast(m.page.copied); }}><Copy size={15} /> {m.page.copy} {m.page.link}</button>
      </div>
    );
  }
  const card = (x: MeetingItem) => (
    <li key={x.id} className={`meet-item${x.status !== "scheduled" ? " muted" : ""}`}>
      <div className="meet-when">
        <strong>{fmt(x.starts_at, { weekday: "short", day: "numeric", month: "short" })}</strong>
        <span><bdi>{fmt(x.starts_at, { hour: "numeric", minute: "2-digit" })}</bdi>{x.ends_at && <> – <bdi>{fmt(x.ends_at, { hour: "numeric", minute: "2-digit" })}</bdi></>}</span>
      </div>
      <div className="meet-who">
        <Link href={`/crm/${x.lead_id}`} className="meet-name" dir="auto">{x.guest_name || x.lead?.name || x.title}</Link>
        <span className="meet-sub" dir="auto">{[x.lead?.company_name, x.guest_email].filter(Boolean).join(" · ") || x.title}</span>
        {x.guest_note && <span className="meet-sub" dir="auto">{m.guestNote}: {x.guest_note}</span>}
        <span className="meet-tags"><span className="meet-tag">{m.source[x.source]}</span>{x.status !== "scheduled" && <span className="meet-tag">{m.status[x.status]}</span>}{x.location && !x.url && <span className="meet-sub" dir="auto">{x.location}</span>}</span>
      </div>
      <div className="meet-actions">
        {x.url && x.status === "scheduled" && <a className="sdr-btn sm" href={x.url} target="_blank" rel="noreferrer"><Video />{m.join}</a>}
        {x.status === "scheduled" && (<>
          <button type="button" className="sdr-icon-btn bordered" title={m.done} aria-label={m.done} disabled={pending} onClick={() => act(x.id, "completed")}><Check /></button>
          <button type="button" className="sdr-icon-btn bordered" title={m.noShow} aria-label={m.noShow} disabled={pending} onClick={() => act(x.id, "no_show")}><UserX /></button>
          <button type="button" className="sdr-icon-btn bordered" title={m.cancel} aria-label={m.cancel} disabled={pending} onClick={() => act(x.id, "canceled")}><X /></button>
        </>)}
      </div>
    </li>
  );
  return (
    <section className="sdr-panel meet-list">
      {upcoming.length > 0 && (<><h3 className="meet-group">{m.upcoming}</h3><ul>{upcoming.map(card)}</ul></>)}
      {past.length > 0 && (<><h3 className="meet-group">{m.past}</h3><ul>{past.map(card)}</ul></>)}
    </section>
  );
}
