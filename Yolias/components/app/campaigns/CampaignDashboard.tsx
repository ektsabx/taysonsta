import Link from "next/link";
import { BadgeCheck, CalendarCheck, CircleDollarSign, Megaphone, MessageSquareReply, Send, Target, Users } from "lucide-react";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { CampaignMetrics } from "@/services/campaign-metrics";

// The campaign part of the dashboard (D-270): totals (actual only), what needs
// the member, progress to each campaign's target with its forecast labelled as
// a forecast, a comparison table, Yolias's notes and what it did.

type Activity = { id: number; campaignId: string; kind: string; body: string; at: string; campaign: string };

export async function CampaignDashboard({ found, metrics, activity, rate, waiting, outcomesWaiting, repliesWaiting, meetingsToday, tryAgain }: {
  found: number; metrics: CampaignMetrics[]; activity: Activity[]; rate: number; waiting: string[]; outcomesWaiting: number; repliesWaiting: number; meetingsToday: number; tryAgain: number;
}) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = t.camp.dash;
  const n = (v: number) => formatNumber(v, locale);
  const usd = (v: number) => new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 2 : 0 }).format(v);
  const live = metrics;
  const sum = (k: keyof CampaignMetrics) => live.reduce((s, m) => s + (Number(m[k]) || 0), 0);
  const by = (s: CampaignMetrics["status"]) => live.filter((m) => m.status === s).length;
  const prospectsUsed = sum("prospectsUsed");
  const revenue = sum("revenueUsd");

  if (!live.length) {
    return (
      <section className="ov-panel cd-empty">
        <Megaphone />
        <div><h3>{d.noCampaigns}</h3><p>{d.noCampaignsLine}</p></div>
        <Link className="sdr-btn primary" href="/outreach/new">{d.newCampaign}</Link>
      </section>
    );
  }

  const cards: { key: string; icon: React.ReactNode; label: string; value: string; note?: string; href?: string }[] = [
    { key: "campaigns", icon: <Megaphone />, label: d.campaigns, value: n(live.length), note: fmt(d.byStatus, { active: n(by("active")), scheduled: n(by("scheduled")), paused: n(by("paused")), completed: n(by("completed")) }), href: "/outreach" },
    { key: "found", icon: <Users />, label: d.found, value: n(found), href: "/prospects" },
    { key: "contacted", icon: <Send />, label: d.contacted, value: n(sum("contacted")), note: `${n(sum("sent"))} ${d.sent}` },
    { key: "positive", icon: <MessageSquareReply />, label: d.positive, value: n(sum("positive")), href: "/inbox" },
    { key: "booked", icon: <CalendarCheck />, label: d.booked, value: n(sum("booked")), note: `${n(sum("held"))} ${d.held}`, href: "/meetings" },
    { key: "qualified", icon: <BadgeCheck />, label: d.qualified, value: n(sum("qualified")), href: "/meetings" },
    { key: "customers", icon: <Target />, label: d.customers, value: n(sum("customers")), note: revenue ? `${usd(revenue)} ${d.revenue}` : undefined },
    { key: "spend", icon: <CircleDollarSign />, label: d.spend, value: n(prospectsUsed), note: rate && prospectsUsed ? fmt(d.spendNote, { usd: usd(prospectsUsed * rate) }) : undefined },
  ];

  const pausedByYolias = live.filter((m) => m.status === "paused" && m.failureReason);
  const attention = [
    repliesWaiting ? { key: "hot", text: fmt(d.hot, { n: n(repliesWaiting) }), href: "/inbox?tab=replies" } : null,
    meetingsToday ? { key: "today", text: fmt(d.meetingsToday, { n: n(meetingsToday) }), href: "/meetings" } : null,
    waiting.length ? { key: "approve", text: fmt(d.approvals, { n: n(waiting.length) }), href: `/outreach/${waiting[0]}` } : null,
    pausedByYolias.length ? { key: "paused", text: fmt(d.paused, { n: n(pausedByYolias.length) }), href: `/outreach/${pausedByYolias[0].id}` } : null,
    outcomesWaiting ? { key: "outcomes", text: fmt(d.outcomes, { n: n(outcomesWaiting) }), href: "/meetings" } : null,
    tryAgain ? { key: "again", text: fmt(d.tryAgain, { n: n(tryAgain) }), href: "/prospects?tab=people&noreply=1" } : null,
  ].filter((x): x is { key: string; text: string; href: string } => Boolean(x));

  // Yolias's notes: only from the engines' answers, never invented.
  const notes: { key: string; text: string; href: string }[] = [];
  for (const m of live) {
    const name = m.name;
    if (waiting.includes(m.id)) notes.push({ key: `a-${m.id}`, text: fmt(d.notes.approve, { name }), href: `/outreach/${m.id}` });
    if (m.status === "paused" && m.failureReason) notes.push({ key: `p-${m.id}`, text: fmt(d.notes.paused, { name, reason: m.failureReason }), href: `/outreach/${m.id}` });
    if (m.target && m.pace === "behind") notes.push({ key: `b-${m.id}`, text: fmt(d.notes.behind, { name, got: n(m.towardTarget), target: n(m.target) }), href: `/outreach/${m.id}` });
    if (m.target && m.pace === "ahead") notes.push({ key: `h-${m.id}`, text: fmt(d.notes.ahead, { name, got: n(m.towardTarget), target: n(m.target) }), href: `/outreach/${m.id}` });
    if (m.plan && m.plan.perDay > 0 && (m.pace === "behind" || m.pace === "on_track")) notes.push({ key: `l-${m.id}`, text: fmt(d.notes.plan, { name, perDay: n(m.plan.perDay) }), href: `/outreach/${m.id}` });
  }
  const targeted = live.filter((m) => m.target && m.status !== "draft");
  const ago = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  return (
    <>
      <div className="ov-section-head"><h3>{d.results} <span className="cd-badge">{d.actualBadge}</span></h3></div>
      <div className="ov-grid cd-cards">
        {cards.map((c) => {
          const body = <><span className="ov-head"><span className="ov-icon">{c.icon}</span>{c.label}</span><span className="ov-main"><strong>{c.value}</strong></span>{c.note && <span className="cd-note">{c.note}</span>}</>;
          return c.href ? <Link key={c.key} href={c.href} className="ov-card">{body}</Link> : <div key={c.key} className="ov-card">{body}</div>;
        })}
      </div>

      <div className="ov-two">
        <section className="ov-panel">
          <div className="ov-panel-head"><h3>{d.attention}</h3></div>
          {attention.length ? <ul className="cd-list">{attention.map((a) => <li key={a.key}><Link href={a.href}>{a.text}</Link></li>)}</ul> : <p className="panel-empty">{d.attentionEmpty}</p>}
        </section>
        <section className="ov-panel">
          <div className="ov-panel-head"><h3>{d.insights}</h3></div>
          {notes.length ? <ul className="cd-list">{notes.slice(0, 6).map((a) => <li key={a.key}><Link href={a.href}>{a.text}</Link></li>)}</ul> : <p className="panel-empty">{d.insightsEmpty}</p>}
        </section>
      </div>

      {targeted.length > 0 && (
        <section className="ov-panel">
          <div className="ov-panel-head"><h3>{d.progress}</h3><span className="cd-sub">{d.progressNote}</span></div>
          <div className="cd-progress">
            {targeted.map((m) => {
              const pct = Math.min(100, Math.round((m.towardTarget / m.target!) * 100));
              return (
                <Link key={m.id} href={`/outreach/${m.id}`} className="cd-prog-row">
                  <span className="cd-prog-head"><span dir="auto">{m.name}</span><span className={`cd-pace pace-${m.pace}`}>{t.camp.pace[m.pace]}</span></span>
                  <span className="an-track"><span className="an-fill" style={{ width: `${Math.max(pct, 2)}%` }} /></span>
                  <span className="cd-prog-foot">
                    <span>{d.actualBadge}: <strong>{n(m.towardTarget)}</strong> / {t.camp.kinds.target}: {n(m.target!)}</span>
                    {m.forecast && <span className="cd-forecast">{d.forecastBadge}: {fmt(d.forecastLine, { low: n(m.forecast.low), high: n(m.forecast.high) })}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="ov-panel">
        <div className="ov-panel-head"><h3>{d.compare}</h3><Link className="ws-link" href="/outreach">{d.allCampaigns}</Link></div>
        <div className="cd-table-wrap">
          <table className="cd-table">
            <thead><tr><th>{d.colCampaign}</th><th>{d.colStatus}</th><th>{d.colContacted}</th><th>{d.colPositive}</th><th>{d.colMeetings}</th><th>{d.colQualified}</th><th>{d.colTarget}</th><th>{d.colPace}</th><th>{d.colCost}</th></tr></thead>
            <tbody>
              {live.slice(0, 20).map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/outreach/${m.id}`} dir="auto">{m.name}</Link></td>
                  <td><span className={`cd-status st-${m.status}`}>{t.camp.status[m.status]}</span></td>
                  <td>{n(m.contacted)}</td><td>{n(m.positive)}</td><td>{n(m.booked)}</td><td>{n(m.qualified)}</td>
                  <td>{m.target ? n(m.target) : "–"}</td>
                  <td>{m.target ? t.camp.pace[m.pace] : "–"}</td>
                  <td>{m.costs.perMeeting != null ? usd(m.costs.perMeeting) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ov-panel">
        <div className="ov-panel-head"><h3>{d.activity}</h3></div>
        {activity.length ? (
          <ul className="cd-activity">{activity.map((a) => (
            <li key={a.id}><time>{ago(a.at)}</time><Link href={`/outreach/${a.campaignId}`} dir="auto">{a.campaign}</Link><span dir="auto">{a.body}</span></li>
          ))}</ul>
        ) : <p className="panel-empty">{d.activityEmpty}</p>}
      </section>
    </>
  );
}
