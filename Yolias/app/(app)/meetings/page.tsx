import type { Metadata } from "next";
import type { LeadStage } from "@/types/database";
import Link from "next/link";
import { CalendarDays, Link2, MousePointerClick } from "lucide-react";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { timeZoneChoices, timeZoneLabel } from "@/lib/regions";
import { bookingUrl, ensureBookingPage, visitState } from "@/lib/meetings";
import { formatDateTime, formatNumber } from "@/lib/format";
import { campaignTable } from "@/services/campaign-table";
import { rangeBounds } from "@/lib/campaigns/metrics";
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

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  // D-274: link visits first, then bookings, then the booking page.
  const tab = sp.tab === "page" ? "page" : sp.tab === "bookings" ? "bookings" : "visits";
  const [t, locale] = await Promise.all([getDictionary().then((d) => d.meetings), getLocale()]);
  const page = await ensureBookingPage(session.userId, session.workspace.id, session.profile.full_name, session.email, session.profile.timezone ?? null, session.profile.language);
  const db = await createClient();
  const [{ data: meetings }, { data: calendar }] = await Promise.all([
    db.from("sales_meetings").select("id, lead_id, title, starts_at, ends_at, url, location, status, source, guest_name, guest_email, guest_note, host_id, qualified, brief, campaign:outreach_campaigns(id, name), lead:sales_leads(name, company_name, stage)")
      .eq("workspace_id", session.workspace.id).gte("starts_at", sinceIso(60)).order("starts_at").limit(300),
    db.from("calendar_connections").select("email, status").eq("user_id", session.userId).maybeSingle(),
  ]);
  const rows = (meetings ?? []).map((m) => ({ ...m, lead: m.lead as unknown as { name: string; company_name: string | null; stage: LeadStage } | null, campaign: m.campaign as unknown as { id: string; name: string } | null }));
  const now = nowMs();
  const V = (await getDictionary()).ag.rx.meet;
  // Cost per meeting (owner, 2026-11-03): the last 30 days of every campaign, as on the home page.
  const lines = await campaignTable(session.workspace.id, rangeBounds("30d", new Date()), { includeArchived: true });
  const booked30 = lines.reduce((a, l) => a + l.counts.meetings, 0);
  const spend30 = lines.reduce((a, l) => a + l.counts.spendUsd, 0);
  const usd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="sdr-page">
      <header className="sdr-head">
        <div><h2>{t.title}</h2></div>
        <div className="sdr-head-actions"><a className="sdr-btn" href={bookingUrl(page.slug)} target="_blank" rel="noreferrer"><Link2 />{t.openPage}</a></div>
      </header>
      <dl className="mv-stats meet-cost">
        <div><dt>{V.cost.meetings}</dt><dd>{formatNumber(booked30, locale)}</dd></div>
        <div><dt>{V.cost.spend}</dt><dd>{usd(spend30)}</dd></div>
        <div><dt>{V.cost.perMeeting}</dt><dd>{booked30 ? usd(spend30 / booked30) : "–"}</dd></div>
      </dl>
      <nav className="sdr-tabs" aria-label={t.title}>
        <Link href="/meetings" className={tab === "visits" ? "active" : ""} aria-current={tab === "visits" ? "page" : undefined}><MousePointerClick />{V.visitsTab}</Link>
        <Link href="/meetings?tab=bookings" className={tab === "bookings" ? "active" : ""} aria-current={tab === "bookings" ? "page" : undefined}><CalendarDays />{t.tabs.bookings}<span className="sdr-count">{rows.filter((m) => m.status === "scheduled" && Date.parse(m.starts_at) >= now).length}</span></Link>
        <Link href="/meetings?tab=page" className={tab === "page" ? "active" : ""} aria-current={tab === "page" ? "page" : undefined}><Link2 />{t.tabs.page}</Link>
      </nav>
      {tab === "visits" ? <Visits workspaceId={session.workspace.id} locale={locale} timeZone={session.profile.timezone ?? null} /> : tab === "bookings" ? (
        <MeetingList
          upcoming={rows.filter((m) => m.status === "scheduled" && Date.parse(m.ends_at ?? m.starts_at) >= now)}
          past={rows.filter((m) => !(m.status === "scheduled" && Date.parse(m.ends_at ?? m.starts_at) >= now)).reverse()}
          timeZone={session.profile.timezone ?? null}
        />
      ) : (
        <BookingPageForm page={page} link={bookingUrl(page.slug)} calendar={calendar && calendar.status !== "disconnected" ? calendar.email ?? "Google" : null} zones={timeZoneChoices(page.timezone).map((z) => ({ value: z, label: timeZoneLabel(z, locale) }))} />
      )}
    </div>
  );
}

/**
 * Booking link visits (D-274): who opened the member's link (from which
 * campaign), who started the form and left (like an abandoned checkout, with
 * what they typed), and who booked. The last 30 days.
 */
async function Visits({ workspaceId, locale, timeZone }: { workspaceId: string; locale: "en" | "ar"; timeZone: string | null }) {
  const t = (await getDictionary()).ag.rx.meet;
  const V = t.visits;
  const db = await createClient();
  const { data } = await db.from("booking_visits").select("id, created_at, updated_at, started_at, meeting_id, name, email, lead_id, campaign:outreach_campaigns(id, name)")
    .eq("workspace_id", workspaceId).gte("created_at", sinceIso(30)).order("created_at", { ascending: false }).limit(500);
  const rows = (data ?? []).map((v) => ({ ...v, state: visitState(v), campaign: v.campaign as unknown as { id: string; name: string } | null }));
  const n = (x: number) => formatNumber(x, locale);
  const booked = rows.filter((r) => r.state === "booked").length;
  const started = rows.filter((r) => r.state === "started").length;
  if (!rows.length) return <section className="sdr-panel meet-list"><p className="meet-muted meet-empty">{V.empty}</p></section>;
  return (
    <section className="sdr-panel">
      <dl className="mv-stats">
        <div><dt>{V.visits}</dt><dd>{n(rows.length)}</dd></div>
        <div><dt>{V.booked}</dt><dd>{n(booked)}</dd></div>
        <div><dt>{V.started}</dt><dd>{n(started)}</dd></div>
        <div><dt>{V.rate}</dt><dd>{rows.length ? `${Math.round((booked / rows.length) * 100)}%` : "–"}</dd></div>
      </dl>
      <div className="sdr-table-wrap">
        <table className="sdr-table">
          <thead><tr><th>{V.colWho}</th><th>{V.colFrom}</th><th>{V.colState}</th><th>{V.colWhen}</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><span className="sdr-cell-main" dir="auto">{r.name || r.email || V.unknown}</span>{r.name && r.email && <span className="sdr-cell-sub" dir="ltr">{r.email}</span>}</td>
                <td>{r.campaign ? <Link href={`/outreach/${r.campaign.id}`} dir="auto">{r.campaign.name}</Link> : <span className="sdr-cell-sub">{V.direct}</span>}</td>
                <td><span className={`sdr-badge nodot ${r.state === "booked" ? "green" : r.state === "started" ? "amber" : "gray"}`}>{V.states[r.state]}</span></td>
                <td>{formatDateTime(r.created_at, locale, timeZone ?? undefined)}</td>
                <td className="num">{r.state === "started" && r.lead_id ? <Link className="sdr-btn ghost sm" href={`/inbox?lead=${r.lead_id}`}>{V.write}</Link> : r.state === "started" && r.email ? <a className="sdr-btn ghost sm" href={`mailto:${r.email}`}>{V.write}</a> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
