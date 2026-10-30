"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { CalendarCheck, Clock, MapPin, Video } from "lucide-react";
import { bookAction } from "./actions";
import type { DaySlots } from "@/lib/meetings/availability";
import type { MeetingType } from "@/types/database";

// The booking page a guest sees (D-267): pick a day, a time (shown in the
// guest's own time zone), leave a name and email, done. Its own copy in both
// languages: the reader is the member's guest, not a Yolias user.
const copy = {
  en: {
    pickType: "Pick a meeting", minutes: (n: number) => `${n} minutes`, pickDay: "Pick a day", pickTime: "Pick a time", times: (tz: string) => `Times in ${tz}`,
    name: "Your name", email: "Your email", note: "Anything to share before the meeting? (optional)", book: "Book the meeting", booking: "Booking…",
    back: "Change the time", done: "You're booked", doneLead: (when: string) => `See you on ${when}. A confirmation is on its way to your email.`,
    join: "Meeting link", closed: "This page isn't taking bookings right now.", none: "No free times in the coming days.", by: "Booking by Yolias",
    errors: { taken: "That time was just taken. Pick another one.", invalid: "Check your name and email.", closed: "This page isn't taking bookings right now.", not_found: "This page doesn't exist.", busy: "You've booked several meetings today already. Reply to the confirmation email instead." },
  },
  ar: {
    pickType: "اختر نوع الاجتماع", minutes: (n: number) => `${n} دقيقة`, pickDay: "اختر يومًا", pickTime: "اختر موعدًا", times: (tz: string) => `المواعيد بتوقيت ${tz}`,
    name: "اسمك", email: "بريدك الإلكتروني", note: "هل تريد مشاركة شيء قبل الاجتماع؟ (اختياري)", book: "احجز الاجتماع", booking: "جارٍ الحجز…",
    back: "غيّر الموعد", done: "تم الحجز", doneLead: (when: string) => `نراك ${when}. رسالة التأكيد في طريقها إلى بريدك.`,
    join: "رابط الاجتماع", closed: "هذه الصفحة لا تستقبل حجوزات حاليًا.", none: "لا توجد مواعيد متاحة في الأيام القادمة.", by: "الحجز عبر يولياس",
    errors: { taken: "حُجز هذا الموعد للتو. اختر موعدًا آخر.", invalid: "راجع اسمك وبريدك.", closed: "هذه الصفحة لا تستقبل حجوزات حاليًا.", not_found: "هذه الصفحة غير موجودة.", busy: "حجزت عدة اجتماعات اليوم بالفعل. رد على رسالة التأكيد بدلًا من ذلك." },
  },
};

const noSubscribe = () => () => {};
const guestZone = (fallback: string) => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback; } catch { return fallback; } };

export function BookingForm(p: {
  locale: "en" | "ar"; slug: string; host: { name: string; company: string | null }; title: string; location: string | null;
  timezone: string; enabled: boolean; types: { type: MeetingType; days: DaySlots[] }[];
}) {
  const t = copy[p.locale];
  // Meeting types (D-269): the guest picks one when the page offers more than one.
  const [typeKey, setTypeKey] = useState(p.types[0]?.type.key ?? "main");
  const chosen = p.types.find((x) => x.type.key === typeKey) ?? p.types[0];
  const fmtLocale = p.locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  // The guest's own time zone in the browser; the page's on the server (no hydration mismatch).
  const tz = useSyncExternalStore(noSubscribe, () => guestZone(p.timezone), () => p.timezone);
  // Days and times in the guest's time zone (a slot can move to the next day).
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    const key = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
    for (const d of chosen?.days ?? []) for (const s of d.slots) m.set(key(s), [...(m.get(key(s)) ?? []), s]);
    return [...m.entries()];
  }, [chosen, tz]);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", note: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ start: string; url: string | null; location: string | null } | null>(null);
  const [pending, start] = useTransition();
  const current = day ?? byDay[0]?.[0] ?? null;
  const dayLabel = (d: string) => new Intl.DateTimeFormat(fmtLocale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const time = (iso: string) => new Intl.DateTimeFormat(fmtLocale, { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  const when = (iso: string) => new Intl.DateTimeFormat(fmtLocale, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot) return;
    setError(null);
    start(async () => {
      const r = await bookAction({ slug: p.slug, start: slot, type: typeKey, ...form });
      if (r.ok) setDone(r);
      else { setError(t.errors[r.error]); if (r.error === "taken") setSlot(null); }
    });
  };

  return (
    <div className="meet-page" dir={p.locale === "ar" ? "rtl" : "ltr"}>
      <main className="meet-card">
        <header className="meet-head">
          <p className="meet-host">{[p.host.name, p.host.company].filter(Boolean).join(" · ")}</p>
          <h1 dir="auto">{chosen?.type.title ?? p.title}</h1>
          <p className="meet-facts"><span><Clock size={15} />{t.minutes(chosen?.type.duration_min ?? 30)}</span>{p.location ? <span dir="auto"><MapPin size={15} />{p.location}</span> : <span><Video size={15} />Google Meet</span>}</p>
          {chosen?.type.description && <p className="meet-desc" dir="auto">{chosen.type.description}</p>}
          {p.types.length > 1 && !done && (
            <div className="meet-types" role="radiogroup" aria-label={t.pickType}>
              {p.types.map(({ type }) => (
                <button key={type.key} type="button" role="radio" aria-checked={type.key === typeKey} className={type.key === typeKey ? "on" : ""} onClick={() => { setTypeKey(type.key); setDay(null); setSlot(null); }}>
                  <strong dir="auto">{type.title}</strong><span>{t.minutes(type.duration_min)}</span>
                </button>
              ))}
            </div>
          )}
        </header>

        {done ? (
          <section className="meet-done">
            <CalendarCheck className="meet-done-icon" />
            <h2>{t.done}</h2>
            <p>{t.doneLead(when(done.start))}</p>
            {done.url && <p><a className="meet-link" href={done.url} target="_blank" rel="noreferrer">{t.join}</a></p>}
          </section>
        ) : !p.enabled ? <p className="meet-empty">{t.closed}</p> : !byDay.length ? <p className="meet-empty">{t.none}</p> : !slot ? (
          <section>
            <h2 className="meet-step">{t.pickDay}</h2>
            <div className="meet-days">{byDay.map(([d]) => <button key={d} type="button" className={d === current ? "on" : ""} onClick={() => setDay(d)}>{dayLabel(d)}</button>)}</div>
            <h2 className="meet-step">{t.pickTime}</h2>
            <p className="meet-tz">{t.times(tz)}</p>
            <div className="meet-times">{(byDay.find(([d]) => d === current)?.[1] ?? []).map((s) => <button key={s} type="button" dir="ltr" onClick={() => setSlot(s)}>{time(s)}</button>)}</div>
          </section>
        ) : (
          <form className="meet-form" onSubmit={submit}>
            <p className="meet-picked"><strong>{when(slot)}</strong> <button type="button" className="meet-back" onClick={() => setSlot(null)}>{t.back}</button></p>
            <label>{t.name}<input required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" dir="auto" /></label>
            <label>{t.email}<input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" dir="ltr" /></label>
            <label>{t.note}<textarea rows={3} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} dir="auto" /></label>
            <input className="meet-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            {error && <p className="meet-error" role="alert">{error}</p>}
            <button type="submit" className="meet-submit" disabled={pending}>{pending ? t.booking : t.book}</button>
          </form>
        )}
        {error && !slot && <p className="meet-error" role="alert">{error}</p>}
      </main>
      {/* "Booking by Yolias" opens the Yolias website (owner, 2026-10-30), marked as coming from a booking page. */}
      <a className="meet-by" href={`${p.locale === "ar" ? "/ar" : "/"}?utm_source=booking_page&utm_medium=referral`} target="_blank" rel="noopener">{t.by}</a>
    </div>
  );
}
