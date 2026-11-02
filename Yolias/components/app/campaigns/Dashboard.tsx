"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Info, Mail, MoreHorizontal, Plus, Search, Send, Sparkles, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { formatMetric, metric } from "@/lib/campaigns/metrics";
import { openSettingsTab } from "@/components/app/open-settings";
import { setDailyBudget, stopAllCampaigns } from "@/app/(app)/dashboard/actions";
import { runOutreach } from "@/app/(app)/outreach/actions";
import type { DashboardData, DashRange, Series } from "@/services/dashboard";
import type { StartSteps } from "@/services/start-here";
import { activityText } from "@/lib/campaigns/activity-text";

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

export function Dashboard({ name, data, range, campaignId, steps, canBudget, needs }: {
  name: string; data: DashboardData; range: DashRange; campaignId: string | null; steps: StartSteps; canBudget: boolean;
  needs: { replies: number; today: number; outcomes: number; paused: number; tryAgain: number };
}) {
  const { t, locale } = useI18n();
  const D = t.ag.dash;
  const lang = locale === "ar" ? "ar" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [cap, setCap] = useState<number | null>(data.budget.dailyUsd);
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
  const delivered = c.sent ? (c.sent - c.bounced) / c.sent : null;
  const cpm = metric("cost_per_meeting")!.compute(c), cph = metric("cost_per_held")!.compute(c);
  const running = data.campaigns.filter((l) => l.status === "active" || l.status === "scheduled");
  const shown = data.campaigns.filter((l) => l.status !== "archived");
  const sliderMax = Math.max(100, Math.ceil(((cap ?? 20) * 2) / 50) * 50);

  const next = !steps.search
    ? { icon: Search, title: t.startHere.search, desc: t.startHere.searchDesc, action: <Link className="sdr-btn primary" href="/outreach/new">{t.startHere.searchCta}</Link> }
    : !steps.mailbox
      ? { icon: Mail, title: t.startHere.mailbox, desc: t.startHere.mailboxDesc, action: <button type="button" className="sdr-btn primary" onClick={() => openSettingsTab("integration")}>{t.startHere.mailboxCta}</button> }
      : !steps.booking
        ? { icon: CalendarDays, title: t.startHere.booking, desc: t.startHere.bookingDesc, action: <Link className="sdr-btn primary" href="/meetings?tab=page">{t.startHere.bookingCta}</Link> }
        : !steps.campaign
          ? { icon: Send, title: t.startHere.campaign, desc: t.startHere.campaignDesc, action: <Link className="sdr-btn primary" href="/outreach">{t.startHere.campaignCta}</Link> }
          : null;

  const kpis: { key: string; label: string; value: string; note: string; values: (number | null)[]; tone?: "purple" }[] = [
    { key: "sent", label: D.kpi.sent, value: n(c.sent), note: fmt(D.kpi.sentNote, { first: n(data.firsts), follow: n(data.followUps) }), values: s.sent },
    { key: "meetings", label: D.kpi.meetings, value: n(c.meetings), note: fmt(D.kpi.meetingsNote, { confirmed: n(c.confirmed), held: n(c.held) }), values: s.meetings },
    { key: "cpm", label: D.kpi.cpm, value: cpm == null ? "–" : usd(cpm), note: cpm == null ? D.kpi.cpmNone : cph == null ? " " : fmt(D.kpi.cpmNote, { usd: usd(cph) }), values: s.meetings.map((m, i) => (m ? s.spent[i] / m : 0)), tone: "purple" },
    { key: "spent", label: D.kpi.spent, value: usd(c.spendUsd), note: data.budget.rate ? fmt(D.kpi.spentNote, { n: n(Math.round(c.spendUsd / data.budget.rate)), rate: usd(data.budget.rate) }) : " ", values: s.spent, tone: "purple" },
    { key: "delivered", label: D.kpi.delivered, value: pct(delivered), note: fmt(D.kpi.deliveredNote, { n: n(c.bounced) }), values: s.delivered },
    { key: "replies", label: D.kpi.replies, value: n(c.replies), note: fmt(D.kpi.repliesNote, { pct: pct(c.contacted ? c.replies / c.contacted : null) }), values: s.replies },
    { key: "interested", label: D.kpi.interested, value: n(c.interested), note: fmt(D.kpi.interestedNote, { pct: pct(c.contacted ? c.interested / c.contacted : null) }), values: s.interested },
    { key: "active", label: D.kpi.active, value: n(running.length), note: fmt(D.running, { n: n(running.length), total: n(shown.length) }), values: [] },
  ];
  const needItems = [
    needs.replies && { href: "/inbox?show=needs_you", text: fmt(D.replies, { n: n(needs.replies) }) },
    needs.today && { href: "/meetings", text: fmt(D.today, { n: n(needs.today) }) },
    needs.outcomes && { href: "/meetings?show=past", text: fmt(D.outcomes, { n: n(needs.outcomes) }) },
    needs.paused && { href: "/outreach", text: fmt(D.paused, { n: n(needs.paused) }) },
    needs.tryAgain && { href: "/prospects?noreply=1", text: fmt(D.tryAgain, { n: n(needs.tryAgain) }) },
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <div className="db">
      <h1 className="db-name" dir="auto">{name}</h1>

      <section className={`db-live${data.live ? " on" : ""}`}>
        <span className="db-live-dot" aria-hidden />
        <div className="db-live-text">
          <strong dir="auto">{data.live ? fmt(D.live, { name: data.live.name }) : D.idle}</strong>
          <span dir="auto">{data.live ? (data.live.what ? activityText({ kind: data.live.kind, body: data.live.what, meta: data.live.meta }, lang, t.ag.act) : formatDateTime(data.live.at, locale)) : D.idleLine}</span>
        </div>
        {data.live ? <Link className="sdr-btn primary" href={`/inbox?campaign=${data.live.campaignId}`}>{D.viewConversations}</Link> : <Link className="sdr-btn primary" href="/outreach/new"><Plus />{D.create}</Link>}
      </section>

      <div className="db-row2">
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
              <Link className="sdr-btn" href="/outreach/new"><Plus />{D.create}</Link>
            </>
          )}
        </section>
        <section className="db-card db-budget">
          <div className="db-budget-head">
            <strong>{D.budget}</strong><span className="db-tip" title={D.budgetHint}><Info /></span>
            <span className="db-budget-value">{cap == null ? D.noCap : usd(cap)}</span>
          </div>
          <input type="range" min={0} max={sliderMax} step={1} value={cap ?? 0} disabled={!canBudget} aria-label={D.budget} onChange={(e) => setCap(Number(e.target.value))} />
          <p className="db-budget-line">{fmt(D.spentToday, { usd: usd(data.budget.spentToday) })}</p>
          <div className="db-budget-foot">
            {data.budget.balanceUsd != null && <span className="db-chip">{fmt(D.balance, { usd: usd(data.budget.balanceUsd) })}</span>}
            <span className="db-budget-actions">
              {canBudget && cap !== data.budget.dailyUsd && <button type="button" className="sdr-btn primary sm" disabled={pending} onClick={() => run(() => setDailyBudget(cap))}>{D.saveBudget}</button>}
              {canBudget && data.budget.dailyUsd != null && cap === data.budget.dailyUsd && <button type="button" className="sdr-btn ghost sm" disabled={pending} onClick={() => { setCap(null); run(() => setDailyBudget(null)); }}>{D.capOff}</button>}
              <button type="button" className="sdr-btn sm" onClick={() => openSettingsTab("billing")}>{D.topUp}</button>
            </span>
          </div>
        </section>
      </div>

      <div className="db-section-head">
        <h2>{D.performance}</h2>
        <div className="db-filters">
          <select className="sdr-input sm" aria-label={D.allCampaigns} value={campaignId ?? ""} onChange={(e) => go("campaign", e.target.value || null)}>
            <option value="">{D.allCampaigns}</option>
            {shown.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="sdr-input sm" aria-label={D.performance} value={range} onChange={(e) => go("range", e.target.value === "7d" ? null : e.target.value)}>
            {(["7d", "30d", "90d"] as const).map((r) => <option key={r} value={r}>{D.ranges[r]}</option>)}
          </select>
        </div>
      </div>
      <div className="db-kpis">
        {kpis.map((k) => (
          <article key={k.key} className={`db-kpi${k.key === "cpm" ? " lead" : ""}`}>
            <div className="db-kpi-top"><span>{k.label}</span><small>{k.note}</small></div>
            <strong>{k.value}</strong>
            {k.values.length > 0 ? <Spark values={k.values} days={s.days} tone={k.tone === "purple" ? "purple" : "green"} locale={lang} /> : null}
          </article>
        ))}
      </div>

      <div className="db-section-head">
        <h2>{D.campaigns} <span className="db-count">{n(shown.length)}</span></h2>
        {running.length > 0 && <button type="button" className="sdr-btn" disabled={pending} onClick={() => { if (confirm(D.stopAllConfirm)) run(() => stopAllCampaigns()); }}><Square />{D.stopAll}</button>}
      </div>
      <section className="db-managing">
        <div className="db-managing-head">
          <span className="db-managing-ico"><Sparkles /></span>
          <div><strong>{D.managing}</strong><span>{D.managingLine}</span></div>
        </div>
        {data.activity.length > 0 && (
          <ul className="db-activity">
            {data.activity.slice(0, 3).map((a) => (
              <li key={a.id}><Link href={`/outreach/${a.campaignId}`}><strong dir="auto">{a.campaign}</strong><span dir="auto">{activityText(a, lang, t.ag.act)}</span></Link><small>{formatDateTime(a.at, locale)}</small></li>
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
                <th className="num">{D.col.meetings}</th><th className="num">{D.col.cpm}</th><th className="num">{D.col.spent}</th><th className="num">{D.col.cap}</th><th className="cm-actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id}>
                  <td className="cm-name"><Link href={`/outreach/${l.id}`} dir="auto">{l.name}</Link></td>
                  <td><span className={`cd-status st-${l.status}`}>{t.ag.status[l.status]}</span>{(l.status === "active" || l.status === "scheduled") && <small className="db-perday">{fmt(D.perDay, { n: n(l.dailyLimit ?? 30) })}</small>}</td>
                  <td className="num">{n(l.counts.sent)}</td>
                  <td className="num">{formatMetric(metric("reply_rate")!.compute(l.counts), "pct", lang)}</td>
                  <td className="num">{n(l.counts.interested)}</td>
                  <td className="num">{n(l.counts.meetings)}</td>
                  <td className="num">{formatMetric(metric("cost_per_meeting")!.compute(l.counts), "usd", lang)}</td>
                  <td className="num">{usd(l.counts.spendUsd)}</td>
                  <td className="num">{l.dailyUsd != null ? usd(l.dailyUsd) : l.budgetUsd != null ? `${usd(l.budgetUsd)}` : "–"}</td>
                  <td className="cm-actions">
                    <div className="cm-wrap">
                      <button type="button" className="sdr-icon-btn cm-toggle" aria-label={t.ag.manager.edit} aria-expanded={menu === l.id} onClick={() => setMenu(menu === l.id ? null : l.id)}><MoreHorizontal /></button>
                      {menu === l.id && (
                        <div className="cm-menu" role="menu" onMouseLeave={() => setMenu(null)}>
                          <Link role="menuitem" href={`/outreach/${l.id}`}>{t.ag.manager.view}</Link>
                          {l.status !== "archived" && l.status !== "completed" && <Link role="menuitem" href={l.status === "draft" ? `/outreach/new?draft=${l.id}` : `/outreach/${l.id}/edit`}>{t.ag.manager.edit}</Link>}
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
                  <td className="num"><strong>{usd(data.total.spendUsd)}</strong></td>
                  <td /><td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <section className="cm-empty"><h3>{t.ag.manager.empty}</h3><p>{t.ag.manager.emptyLine}</p><Link className="sdr-btn primary" href="/outreach/new"><Plus />{t.ag.manager.create}</Link></section>
      )}

      <section className="db-card db-needs">
        <strong>{D.needs}</strong>
        {needItems.length ? <ul>{needItems.map((x) => <li key={x.href}><Link href={x.href}>{x.text}</Link></li>)}</ul> : <p className="ws-hint">{D.needsEmpty}</p>}
      </section>
    </div>
  );
}
