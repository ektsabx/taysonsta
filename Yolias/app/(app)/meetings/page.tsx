import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Link2 } from "lucide-react";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { timeZoneChoices, timeZoneLabel } from "@/lib/regions";
import { bookingUrl, ensureBookingPage } from "@/lib/meetings";
import { calendarConfigured } from "@/lib/meetings/google";
import { BookingPageForm } from "@/components/app/meetings/BookingPageForm";
import { MeetingList } from "@/components/app/meetings/MeetingList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).meetings.title} | Yolias` };
}

// Meetings inside Yolias (owner, 2026-10-30, D-267): every meeting of the
// workspace (booked on a page, by Yolias in a reply, or added by hand) and
// the member's own booking page with Google Calendar.
const sinceIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const nowMs = () => Date.now();

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; calendar?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const tab = sp.tab === "page" ? "page" : "bookings";
  const [t, locale] = await Promise.all([getDictionary().then((d) => d.meetings), getLocale()]);
  const page = await ensureBookingPage(session.userId, session.workspace.id, session.profile.full_name, session.email, session.profile.timezone ?? null, session.profile.language);
  const db = await createClient();
  const [{ data: meetings }, { data: calendar }, googleReady] = await Promise.all([
    db.from("sales_meetings").select("id, lead_id, title, starts_at, ends_at, url, location, status, source, guest_name, guest_email, guest_note, host_id, lead:sales_leads(name, company_name)")
      .eq("workspace_id", session.workspace.id).gte("starts_at", sinceIso(60)).order("starts_at").limit(300),
    db.from("calendar_connections").select("email, status, error").eq("user_id", session.userId).maybeSingle(),
    calendarConfigured(),
  ]);
  const rows = (meetings ?? []).map((m) => ({ ...m, lead: m.lead as unknown as { name: string; company_name: string | null } | null }));
  const now = nowMs();
  return (
    <div className="sdr-page">
      <header className="sdr-head">
        <div><h2>{t.title}</h2></div>
        <div className="sdr-head-actions"><a className="sdr-btn" href={bookingUrl(page.slug)} target="_blank" rel="noreferrer"><Link2 />{t.openPage}</a></div>
      </header>
      <nav className="sdr-tabs" aria-label={t.title}>
        <Link href="/meetings" className={tab === "bookings" ? "active" : ""} aria-current={tab === "bookings" ? "page" : undefined}><CalendarDays />{t.tabs.bookings}<span className="sdr-count">{rows.filter((m) => m.status === "scheduled" && Date.parse(m.starts_at) >= now).length}</span></Link>
        <Link href="/meetings?tab=page" className={tab === "page" ? "active" : ""} aria-current={tab === "page" ? "page" : undefined}><Link2 />{t.tabs.page}</Link>
      </nav>
      {tab === "bookings" ? (
        <MeetingList
          upcoming={rows.filter((m) => m.status === "scheduled" && Date.parse(m.ends_at ?? m.starts_at) >= now)}
          past={rows.filter((m) => !(m.status === "scheduled" && Date.parse(m.ends_at ?? m.starts_at) >= now)).reverse()}
          timeZone={session.profile.timezone ?? null}
          bookingLink={bookingUrl(page.slug)}
        />
      ) : (
        <BookingPageForm page={page} link={bookingUrl(page.slug)} calendar={calendar ?? null} googleReady={googleReady} notice={sp.calendar ?? null} zones={timeZoneChoices(page.timezone).map((z) => ({ value: z, label: timeZoneLabel(z, locale) }))} />
      )}
    </div>
  );
}
