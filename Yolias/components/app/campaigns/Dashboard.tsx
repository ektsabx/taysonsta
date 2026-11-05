"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Mail, MoreHorizontal, Plus, Search, Send, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { formatMetric, metric } from "@/lib/campaigns/metrics";
import { openSettingsTab } from "@/components/app/open-settings";
import { runOutreach } from "@/app/(app)/campaigns/actions";
import type { DashboardData, DashRange, Series } from "@/services/dashboard";
import type { StartSteps } from "@/services/start-here";
import { activityText } from "@/lib/campaigns/activity-text";
import { Greeting } from "@/components/app/Greeting";
import { DateRange } from "@/components/app/campaigns/DateRange";

// The dashboard (owner, 2026-10-31, D-273), laid out like the reference the
// owner chose: what Yolias is doing now, the next step and the daily budget,
// performance with a small chart per number (cost per meeting among them),
// then the campaigns with their results, spend and daily cap, what Yolias did
// last, and what needs the member. Yolias's own colours and type.

const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v % 1 ? 2 : 0, minimumFractionDigits: v % 1 ? 2 : 0 }).format(v);

function Spark({ values, days, tone = "green", locale }: { values: (number | null)[]; days: string[]; tone?: "green" | "purple"; locale: "en" | "ar" }) {
  const nums = values.map((v) => v ?? 0);
  const max = Math.max(1, ...nums);
  const w = 260, h = 44, step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = nums.map((v, i) => `${(i * step).toFixed(1)},${(h - 4 - (v / max) * (h - 10)).toFixed(1)}`).join(" ");
  const loc = locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const tick = (i: number) => new Date(`${days[i]}T00:00:00Z`).toLocaleDateString(loc, days.length <= 14 ? { weekday: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
  const marks = days.length <= 8 ? days.map((_, i) => i).filter((i) => i % 2 === 0) : [0, Math.floor(days.length / 3), Math.floor((2 * days.length) / 3), days.length - 1];
  return (
    <div className={`db-spark ${tone}`}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        <line x1="0" x2={w} y1={h - 4} y2={h - 4} className="db-spark-base" />
        <polyline points={pts} fill="none" />
        {nums.map((v, i) => (values.length <= 14 ? <circle key={i} cx={i * step} cy={h - 4 - (v / max) * (h - 10)} r="2.2" /> : null))}
      </svg>
      <div className="db-spark-x">{marks.map((i) => <span key={i}>{tick(i)}</span>)}</div>
    </div>
  );
}

export function Dashboard({ name, data, range, campaignId, steps, from = "", to = "" }: {
  name: string | null; data: DashboardData; range: DashRange; campaignId: string | null; steps: StartSteps; from?: string; to?: string;
}) {
  const { t, locale } = useI18n();
  const D = t.ag.dash;
  const lang = locale === "ar" ? "ar" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [, start] = useTransition();
  const [menu, setMenu] = useState<string | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  const pct = (v: number | null) => (v == null ? "–" : `${(v * 100).toFixed(v * 100 < 10 ? 1 : 0)}%`);
  const c = data.counts;
  const go = (k: string, v: string | null) => { const p = new URLSearchParams(sp.toString()); if (v) p.set(k, v); else p.delete(k); router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }); };
  const run = <R extends { ok: boolean; message?: string }>(fn: () => Promise<R>) => start(async () => {
    const r = await callAction(fn);
    if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
    if (!r.ok) { toast((r as unknown as { error: string }).error, "error"); return; }
    if (r.message) toast(r.message);
    router.refresh();
  });
  const s: Series = data.series;
  const cpm = metric("cost_per_meeting")!.compute(c);
  const running = data.campaigns.filter((l) => l.status === "active" || l.status === "scheduled");
  const shown = data.campaigns.filter((l) => l.status !== "archived");

  const next = !steps.search
    ? { icon: Search, title: t.startHere.search, desc: t.startHere.searchDesc, action: <Link className="sdr-btn primary" href="/campaigns/new">{t.startHere.searchCta}</Link> }
    : !steps.mailbox
      ? { icon: Mail, title: t.startHere.mailbox, desc: t.startHere.mailboxDesc, action: <button type="button" className="sdr-btn primary" onClick={() => openSettingsTab("integration")}>{t.startHere.mailboxCta}</button> }
      : !steps.booking
        ? { icon: CalendarDays, title: t.startHere.booking, desc: t.startHere.bookingDesc, action: <Link className="sdr-btn primary" href="/meetings?tab=page">{t.startHere.bookingCta}</Link> }
        : !steps.campaign
          ? { icon: Send, title: t.startHere.campaign, desc: t.startHere.campaignDesc, action: <Link className="sdr-btn primary" href="/campaigns">{t.startHere.campaignCta}</Link> }
          : null;

  // D-274: what Yolias found, sent, what was opened and answered, then the result: meetings held and what each cost.
  const R = t.ag.rx.dash;
  // D-274: the result is a booked meeting (owner); the booking link's visits beside it.
  const kpis: { key: string; label: string; value: string; note: string; values: (number | null)[]; tone?: "purple"; lead?: boolean }[] = [
    { key: "found", label: R.found, value: n(c.foundPeople + c.foundCompanies), note: fmt(R.foundNote, { companies: n(c.foundCompanies), people: n(c.foundPeople) }), values: s.found },
    { key: "sent", label: D.kpi.sent, value: n(c.sent), note: fmt(R.openedNote, { pct: pct(c.contacted ? c.opened / c.contacted : null) }), values: s.sent },
    { key: "replies", label: R.replies, value: n(c.replies), note: fmt(R.repliesNote, { pct: pct(c.contacted ? c.replies / c.contacted : null), n: n(Math.max(c.contacted - c.replies, 0)) }), values: s.replies },
    { key: "visits", label: R.visits, value: n(c.visits), note: fmt(R.visitsNote, { n: n(c.linkBooked) }), values: s.visits },
    { key: "meetings", label: R.booked, value: n(c.meetings), note: R.heldNote, values: s.meetings, lead: true },
    { key: "cpm", label: R.cpm, value: cpm == null ? "–" : usd(cpm), note: cpm == null ? R.cphNone : fmt(R.cpmNote, { n: n(c.held) }), values: s.meetings.map((m, i) => (m ? s.spent[i] / m : 0)), tone: "purple", lead: true },
    { key: "interested", label: R.positive, value: n(c.interested), note: fmt(R.positiveNote, { pct: pct(c.contacted ? c.interested / c.contacted : null) }), values: s.interested },
    { key: "spent", label: D.kpi.spent, value: usd(c.spendUsd), note: data.budget.rate ? fmt(D.kpi.spentNote, { n: n(Math.round(c.spendUsd / data.budget.rate)), rate: usd(data.budget.rate) }) : " ", values: s.spent, tone: "purple" },
  ];
  const A = t.ag.rx.balance;
  const acct = data.account;

  return (
    <div className="db">
      {/* D-274: "Good morning, Youseef", like Yolias AI. */}
      <Greeting name={name} className="db-name" />

      <section className={`db-live${data.live ? " on" : ""}`}>
        <span className="db-live-dot" aria-hidden />
        <div className="db-live-text">
          <strong dir="auto">{data.live ? fmt(D.live, { name: data.live.name }) : D.idle}</strong>
          <span dir="auto">{data.live ? (data.live.what ? activityText({ kind: data.live.kind, body: data.live.what, meta: data.live.meta }, lang, t.ag.act) : formatDateTime(data.live.at, locale)) : D.idleLine}</span>
        </div>
        {data.live ? <Link className="sdr-btn primary" href={`/campaigns/${data.live.campaignId}`}>{t.ag.rx.prospects.open}</Link> : <Link className="sdr-btn primary" href="/campaigns/new"><Plus />{D.create}</Link>}
      </section>

      <div className="db-row1">
        <section className="db-card db-next">
          {next ? (
            <>
              <span className="db-next-ico"><next.icon /></span>
              <div><small>{D.next}</small><strong>{next.title}</strong><p>{next.desc}</p></div>
              {next.action}
            </>
          ) : (
            <>
              <span className="db-next-ico"><Sparkles /></span>
              <div><small>{D.next}</small><strong>{D.allSet}</strong><p>{D.allSetLine}</p></div>
              <Link className="sdr-btn" href="/campaigns/new"><Plus />{D.create}</Link>
            </>
          )}
        </section>
      </div>

      {acct.totalUsd != null && acct.leftUsd != null && (
        <section className="db-card db-account">
          <div className="db-account-main">
            <strong>{A.title}</strong>
            <span className="db-account-left"><bdi dir="ltr">{usd(acct.leftUsd)}</bdi>{acct.totalUsd > 0 && <small>{fmt(A.of, { total: usd(Math.max(acct.totalUsd, acct.leftUsd)) })}</small>}</span>
            <span>{acct.renewsAt ? fmt(A.renews, { date: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { day: "numeric", month: "long" }).format(new Date(acct.renewsAt)) }) : A.credit}</span>
            <div className="db-account-bar" role="img" aria-label={`${usd(acct.leftUsd)} ${fmt(A.of, { total: usd(acct.totalUsd) })}`}><i style={{ width: `${acct.totalUsd > 0 ? Math.min(100, (acct.leftUsd / Math.max(acct.totalUsd, acct.leftUsd)) * 100) : 0}%` }} /></div>
          </div>
          <button type="button" className="sdr-btn sm" onClick={() => openSettingsTab("usage")}>{D.topUp}</button>
          <dl className="db-account-stats">
            <div><dt>{A.spent}</dt><dd><bdi dir="ltr">{usd(acct.spentMonthUsd)}</bdi></dd></div>
          </dl>
        </section>
      )}

      <div className="db-section-head">
        <h2>{D.performance}</h2>
        <div className="db-filters">
          <select className="sdr-input sm" aria-label={D.allCampaigns} value={campaignId ?? ""} onChange={(e) => go("campaign", e.target.value || null)}>
            <option value="">{D.allCampaigns}</option>
            {shown.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <DateRange range={range} from={from} to={to} defaultRange="7d" />
        </div>
      </div>
      <div className="db-kpis">
        {kpis.map((k) => (
          <article key={k.key} className={`db-kpi${k.lead ? " lead" : ""}`}>
            <div className="db-kpi-top"><span>{k.label}</span><small>{k.note}</small></div>
            <strong>{k.value}</strong>
            {k.values.length > 0 ? <Spark values={k.values} days={s.days} tone={k.tone === "purple" ? "purple" : "green"} locale={lang} /> : null}
          </article>
        ))}
      </div>

      <div className="db-section-head">
        <h2>{D.campaigns} <span className="db-count">{n(shown.length)}</span></h2>
      </div>
      <section className="db-managing">
        <div className="db-managing-head">
          <span className="db-managing-ico"><Sparkles /></span>
          <div><strong>{D.managing}</strong><span>{D.managingLine}</span></div>
        </div>
        {data.activity.length > 0 && (
          <ul className="db-activity">
            {data.activity.slice(0, 3).map((a) => (
              <li key={a.id}><Link href={`/campaigns/${a.campaignId}`}><strong dir="auto">{a.campaign}</strong><span dir="auto">{activityText(a, lang, t.ag.act)}</span></Link><small>{formatDateTime(a.at, locale)}</small></li>
            ))}
          </ul>
        )}
      </section>
      {shown.length ? (
        <div className="cm-table-wrap db-table">
          <table className="cm-table">
            <thead>
              <tr>
                <th className="cm-name">{D.col.campaign}</th><th>{D.col.state}</th><th className="num">{D.col.sent}</th><th className="num">{D.col.replyRate}</th><th className="num">{D.col.interested}</th>
                <th className="num">{R.booked}</th><th className="num">{R.cpm}</th><th className="num">{R.held}</th><th className="num">{D.col.spent}</th><th className="num">{D.col.cap}</th><th className="cm-actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id}>
                  <td className="cm-name"><Link href={`/campaigns/${l.id}`} dir="auto">{l.name}</Link></td>
                  <td><span className={`cd-status st-${l.status}`}>{t.ag.status[l.status]}</span>{(l.status === "active" || l.status === "scheduled") && <small className="db-perday">{fmt(D.perDay, { n: n(l.dailyLimit ?? 30) })}</small>}</td>
                  <td className="num">{n(l.counts.sent)}</td>
                  <td className="num">{formatMetric(metric("reply_rate")!.compute(l.counts), "pct", lang)}</td>
                  <td className="num">{n(l.counts.interested)}</td>
                  <td className="num">{n(l.counts.meetings)}</td>
                  <td className="num">{formatMetric(metric("cost_per_meeting")!.compute(l.counts), "usd", lang)}</td>
                  <td className="num">{n(l.counts.held)}</td>
                  <td className="num">{usd(l.counts.spendUsd)}</td>
                  <td className="num">{l.dailyUsd != null ? usd(l.dailyUsd) : l.budgetUsd != null ? `${usd(l.budgetUsd)}` : "–"}</td>
                  <td className="cm-actions">
                    <div className="cm-wrap">
                      <button type="button" className="sdr-icon-btn cm-toggle" aria-label={t.ag.manager.edit} aria-expanded={menu === l.id} onClick={() => setMenu(menu === l.id ? null : l.id)}><MoreHorizontal /></button>
                      {menu === l.id && (
                        <div className="cm-menu" role="menu" onMouseLeave={() => setMenu(null)}>
                          <Link role="menuitem" href={`/campaigns/${l.id}`}>{t.ag.manager.view}</Link>
                          {l.status !== "archived" && l.status !== "completed" && <Link role="menuitem" href={l.status === "draft" ? `/campaigns/new?draft=${l.id}` : `/campaigns/${l.id}/edit`}>{t.ag.manager.edit}</Link>}
                          {l.status === "active" && <button role="menuitem" type="button" onClick={() => { setMenu(null); run(() => runOutreach(l.id, "pause")); }}>{t.ag.manager.pause}</button>}
                          {l.status === "paused" && l.approved && <button role="menuitem" type="button" onClick={() => { setMenu(null); run(() => runOutreach(l.id, "resume")); }}>{t.ag.manager.resume}</button>}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {shown.length > 1 && (
              <tfoot>
                <tr>
                  <td className="cm-name"><strong>{D.total}</strong></td><td><small>{fmt(D.running, { n: n(running.length), total: n(shown.length) })}</small></td>
                  <td className="num"><strong>{n(data.total.sent)}</strong></td>
                  <td className="num"><strong>{formatMetric(metric("reply_rate")!.compute(data.total), "pct", lang)}</strong></td>
                  <td className="num"><strong>{n(data.total.interested)}</strong></td>
                  <td className="num"><strong>{n(data.total.meetings)}</strong></td>
                  <td className="num"><strong>{formatMetric(metric("cost_per_meeting")!.compute(data.total), "usd", lang)}</strong></td>
                  <td className="num"><strong>{n(data.total.held)}</strong></td>
                  <td className="num"><strong>{usd(data.total.spendUsd)}</strong></td>
                  <td /><td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <section className="cm-empty"><h3>{t.ag.manager.empty}</h3><p>{t.ag.manager.emptyLine}</p><Link className="sdr-btn primary" href="/campaigns/new"><Plus />{t.ag.manager.create}</Link></section>
      )}

    </div>
  );
}
