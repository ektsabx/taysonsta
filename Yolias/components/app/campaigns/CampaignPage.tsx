"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, Copy, Mail, Pause, Pencil, Play, Plus, Square, Trash2, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { formatMetric, metric, type Counts, type RangePreset } from "@/lib/campaigns/metrics";
import { deleteDraft, duplicateCampaign, runOutreach } from "@/app/(app)/outreach/actions";
import { groupAction } from "@/app/(app)/outreach/[id]/actions";
import type { CampaignLine } from "@/services/campaign-table";
import type { CampaignDetailData } from "@/services/campaign-detail";
import { activityText } from "@/lib/campaigns/activity-text";

// A campaign's page (owner, 2026-10-31, D-273): what it is (objective,
// budget, dates, mailbox), its results against the previous period with cost
// per meeting first, and six tabs: overview (day by day, recommendations,
// what Yolias did), audiences (like ad sets: pause, resume, archive, add),
// messages (each audience's openings and the latest emails), conversations,
// meetings and settings. No sequence to manage: that is Yolias's work.

export type CampaignTab = "overview" | "audiences" | "messages" | "conversations" | "meetings" | "settings";
const TABS: CampaignTab[] = ["overview", "audiences", "messages", "conversations", "meetings", "settings"];
const KPIS = ["meetings", "cost_per_meeting", "spend", "reply_rate", "interested", "sent"] as const;

export interface CampaignInfo {
  id: string; name: string; status: CampaignLine["status"]; budgetUsd: number | null; budgetType: "total" | "daily" | "monthly" | null;
  startsAt: string | null; endsAt: string | null; mailbox: string | null; targetMeetings: number | null; dailyLimit: number | null; runDays: string[]; contactFrom: string | null; contactTo: string | null;
  tone: string; language: string; instructions: string | null; senderName: string | null; approved: boolean;
}

export function CampaignPage({ c, tab, range, line, prev, detail, activity, recommendations }: {
  c: CampaignInfo; tab: CampaignTab; range: RangePreset; line: CampaignLine; prev: Counts | null; detail: CampaignDetailData;
  activity: { id: number; kind: string; body: string; at: string; meta?: unknown }[]; recommendations: string[];
}) {
  const { t, locale } = useI18n();
  const P = t.ag.page;
  const lang = locale === "ar" ? "ar" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [pending, start] = useTransition();
  const n = (v: number) => formatNumber(v, locale);
  const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 2 : 0 }).format(v);
  const go = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };
  const run = <R extends { ok: boolean; message?: string }>(fn: () => Promise<R>, after?: (r: R) => void) => start(async () => {
    const r = await callAction(fn);
    if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
    if (!r.ok) { toast((r as unknown as { error: string }).error, "error"); return; }
    if (r.message) toast(r.message);
    after?.(r);
    router.refresh();
  });
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "14d" ? 14 : 0;
  const draft = c.status === "draft";
  const live = c.status === "active" || c.status === "scheduled";
  const editHref = draft ? `/outreach/new?draft=${c.id}` : `/outreach/${c.id}/edit`;
  const budget = c.budgetUsd == null ? "–" : fmt(c.budgetType === "daily" ? P.perDay : P.total, { usd: usd(c.budgetUsd) });
  const dates = c.startsAt ? (c.endsAt ? fmt(P.fromTo, { from: formatDate(c.startsAt, locale), to: formatDate(c.endsAt, locale) }) : fmt(P.fromOpen, { from: formatDate(c.startsAt, locale) })) : "–";
  const daily = detail.breakdowns.day;
  // One scale for the three series, so the bars compare honestly.
  const peak = Math.max(1, ...daily.map((d) => Math.max(d.sent, d.replies, d.meetings)));

  return (
    <div className="sdr-page cp">
      <div><Link className="sdr-back" href="/outreach"><ChevronLeft className="flip-rtl" />{t.ag.manager.title}</Link></div>
      <header className="cp-head">
        <div className="cp-title">
          <h2 dir="auto">{c.name}</h2>
          <span className={`cd-status st-${c.status}`}>{t.ag.status[c.status]}</span>
        </div>
        <div className="cp-actions">
          {!["archived", "completed"].includes(c.status) && <Link className="sdr-btn" href={editHref}><Pencil />{draft ? P.continueDraft : P.edit}</Link>}
          {c.status === "active" && <button type="button" className="sdr-btn" disabled={pending} onClick={() => run(() => runOutreach(c.id, "pause"))}><Pause />{P.pause}</button>}
          {c.status === "paused" && c.approved && <button type="button" className="sdr-btn" disabled={pending} onClick={() => run(() => runOutreach(c.id, "resume"))}><Play />{P.resume}</button>}
          <button type="button" className="sdr-btn" disabled={pending} onClick={() => run(() => duplicateCampaign(c.id), (r) => router.push(`/outreach/new?draft=${(r as unknown as { id: string }).id}`))}><Copy />{P.duplicate}</button>
          {(live || c.status === "paused") && <button type="button" className="sdr-btn" disabled={pending} onClick={() => { if (confirm(P.endConfirm)) run(() => runOutreach(c.id, "end")); }}><Square />{P.end}</button>}
          {draft && <button type="button" className="sdr-btn danger" disabled={pending} onClick={() => { if (confirm(P.deleteConfirm)) run(() => deleteDraft(c.id), () => router.push("/outreach")); }}><Trash2 />{P.deleteDraft}</button>}
          {!draft && c.status !== "archived" && <button type="button" className="sdr-btn ghost" disabled={pending} onClick={() => { if (confirm(P.archiveConfirm)) run(() => runOutreach(c.id, "cancel")); }}>{P.archive}</button>}
        </div>
      </header>
      <dl className="cp-meta">
        <div><dt>{t.ag.builder.campaign.objective}</dt><dd>{P.objective}{c.targetMeetings ? ` · ${fmt(P.target, { got: n(line.counts.meetings), target: n(c.targetMeetings) })}` : ""}</dd></div>
        <div><dt>{P.budget}</dt><dd>{budget}</dd></div>
        <div><dt>{P.dates}</dt><dd>{dates}</dd></div>
        <div><dt>{P.sender}</dt><dd dir="ltr">{c.mailbox ?? P.noSender}</dd></div>
      </dl>

      <div className="cp-range">
        {(["7d", "30d", "lifetime"] as const).map((r) => <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => go("range", r === "lifetime" ? null : r)}>{t.ag.manager.ranges[r]}</button>)}
      </div>
      <div className="cp-kpis">
        {KPIS.map((id) => {
          const m = metric(id)!;
          const v = m.compute(line.counts), before = prev ? m.compute(prev) : null;
          const delta = v != null && before != null && before !== 0 ? (v - before) / before : null;
          const good = id === "cost_per_meeting" ? (delta ?? 0) < 0 : (delta ?? 0) > 0;
          return (
            <div key={id} className={`cp-kpi${id === "cost_per_meeting" ? " lead" : ""}`}>
              <span className="cp-kpi-label">{m.label[lang]}</span>
              <strong>{formatMetric(v, m.format, lang)}</strong>
              <small>{delta != null && days ? <span className={good ? "up" : "down"}>{good ? <ArrowUpRight /> : <ArrowDownRight />}{`${Math.abs(Math.round(delta * 100))}%`} {fmt(P.vsPrevious, { days: String(days) })}</span> : days ? P.noPrevious : " "}</small>
            </div>
          );
        })}
      </div>

      <nav className="cp-tabs" role="tablist">
        {TABS.map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => go("tab", k === "overview" ? null : k)}>{P.tabs[k]}</button>)}
      </nav>

      {tab === "overview" && (
        <div className="cp-grid">
          <section className="cp-card wide">
            <h3>{P.byDay}</h3>
            {daily.length ? (
              <div className="cp-bars" role="img" aria-label={P.byDay}>
                {daily.slice(-30).map((d) => (
                  <div key={d.key} className="cp-bar" title={`${d.key}: ${d.sent} · ${d.replies} · ${d.meetings}`}>
                    <span className="s" style={{ height: `${(d.sent / peak) * 100}%` }} />
                    <span className="r" style={{ height: `${(d.replies / peak) * 100}%` }} />
                    <span className="m" style={{ height: `${(d.meetings / peak) * 100}%` }} />
                    <small>{d.key.slice(8)}</small>
                  </div>
                ))}
              </div>
            ) : <p className="ws-hint">{t.ag.manager.noMessages}</p>}
            <p className="cp-legend"><i className="s" />{metric("sent")!.label[lang]} <i className="r" />{metric("replies")!.label[lang]} <i className="m" />{metric("meetings")!.label[lang]}</p>
          </section>
          <section className="cp-card">
            <h3>{P.recommendations}</h3>
            {recommendations.length ? <ul className="cp-list">{recommendations.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="ws-hint">{P.noRecommendations}</p>}
          </section>
          <section className="cp-card">
            <h3>{P.activity}</h3>
            {activity.length ? (
              <ul className="cp-activity">{activity.map((a) => <li key={a.id}><span dir="auto">{activityText(a, lang, t.ag.act)}</span><small>{formatDateTime(a.at, locale)}</small></li>)}</ul>
            ) : <p className="ws-hint">{P.activityEmpty}</p>}
          </section>
        </div>
      )}

      {tab === "audiences" && (
        <section className="cp-card">
          <div className="cp-card-head"><h3>{t.ag.manager.tabs.audiences}</h3>{!["archived", "completed"].includes(c.status) && <Link className="sdr-btn sm" href={editHref}><Plus />{P.audiences.add}</Link>}</div>
          {line.groups.length ? (
            <div className="sdr-table-wrap">
              <table className="sdr-table">
                <thead><tr><th>{t.ag.manager.colAudience}</th><th>{t.ag.manager.colStatus}</th>{(["contacted", "reply_rate", "interested", "meetings", "spend", "cost_per_meeting"] as const).map((id) => <th key={id} className="num">{metric(id)!.label[lang]}</th>)}<th /></tr></thead>
                <tbody>
                  {line.groups.map((g) => (
                    <tr key={g.id}>
                      <td><span className="sdr-cell-main" dir="auto"><Users className="cp-ico" />{g.name}</span><span className="sdr-cell-sub">{P.audiences.source[g.source as keyof typeof P.audiences.source] ?? g.source}</span></td>
                      <td><span className={`cd-status st-${g.status}`}>{t.ag.groupStatus[g.status]}</span></td>
                      {(["contacted", "reply_rate", "interested", "meetings", "spend", "cost_per_meeting"] as const).map((id) => <td key={id} className="num">{formatMetric(metric(id)!.compute(g.counts), metric(id)!.format, lang)}</td>)}
                      <td className="num">
                        {g.status === "active" && <button type="button" className="sdr-btn ghost sm" disabled={pending} onClick={() => run(() => groupAction(g.id, "pause"))}>{P.audiences.pause}</button>}
                        {g.status === "paused" && <button type="button" className="sdr-btn ghost sm" disabled={pending} onClick={() => run(() => groupAction(g.id, "resume"))}>{P.audiences.resume}</button>}
                        {g.status !== "archived" && <button type="button" className="sdr-btn ghost sm" disabled={pending} onClick={() => run(() => groupAction(g.id, "archive"))}>{P.audiences.archive}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="ws-hint">{P.audiences.empty}</p>}
        </section>
      )}

      {tab === "messages" && (
        <div className="cp-grid">
          <section className="cp-card wide">
            <h3>{P.messages.openings}</h3>
            <div className="cp-openings">
              {line.groups.flatMap((g) => g.openings.map((o) => (
                <article key={o.key} className="cp-opening">
                  <header><strong>{t.ag.builder.message[o.variant === "a" ? "angleA" : "angleB"]}</strong><span dir="auto">{g.name}</span></header>
                  <p dir="auto">{o.text}</p>
                  <footer>{(["contacted", "reply_rate", "interested", "meetings"] as const).map((id) => <span key={id}><small>{metric(id)!.label[lang]}</small>{formatMetric(metric(id)!.compute(o.counts), metric(id)!.format, lang)}</span>)}</footer>
                </article>
              )))}
            </div>
          </section>
          <section className="cp-card wide">
            <h3>{P.messages.recent}</h3>
            {detail.messages.length ? (
              <div className="sdr-table-wrap">
                <table className="sdr-table">
                  <thead><tr><th>{P.messages.colTo}</th><th>{P.messages.colSubject}</th><th>{P.messages.colOpening}</th><th>{P.messages.colWhen}</th></tr></thead>
                  <tbody>
                    {detail.messages.filter((m) => m.status === "sent").slice(0, 50).map((m) => (
                      <tr key={m.id}>
                        <td><span className="sdr-cell-main" dir="auto">{m.lead}</span></td>
                        <td><Link href={m.leadId ? `/inbox?lead=${m.leadId}` : "/inbox"} className="sdr-cell-main" dir="auto"><Mail className="cp-ico" />{m.subject}</Link><span className="sdr-cell-sub" dir="auto">{m.preview}</span></td>
                        <td>{m.step === 1 ? `${P.messages.firstEmail}${m.variant ? ` · ${m.variant.toUpperCase()}` : ""}` : m.step ? P.messages.followUp : P.messages.reply}</td>
                        <td>{formatDateTime(m.at, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="ws-hint">{P.messages.empty}</p>}
          </section>
        </div>
      )}

      {tab === "conversations" && (
        <section className="cp-card">
          {detail.conversations.length ? (
            <ul className="cp-convs">
              {detail.conversations.map((x) => (
                <li key={x.leadId}>
                  <Link href={`/inbox?lead=${x.leadId}`}>
                    <strong dir="auto">{x.lead}{x.company ? ` · ${x.company}` : ""}</strong>
                    {x.kind && <span className={`sdr-badge nodot ${["interested", "meeting_request"].includes(x.kind) ? "green" : ["not_interested", "stop_request"].includes(x.kind) ? "gray" : "amber"}`}>{P.conversations.kinds[x.kind as keyof typeof P.conversations.kinds] ?? x.kind}</span>}
                    <span className="cp-preview" dir="auto">{x.preview}</span>
                    <small>{formatDateTime(x.at, locale)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="ws-hint">{P.conversations.empty}</p>}
          <Link className="sdr-btn ghost sm" href={`/inbox?campaign=${c.id}`}>{P.conversations.open}</Link>
        </section>
      )}

      {tab === "meetings" && (
        <section className="cp-card">
          {detail.meetings.length ? (
            <ul className="cp-convs">
              {detail.meetings.map((m) => (
                <li key={m.id}>
                  <Link href={`/meetings?lead=${m.leadId}`}>
                    <strong dir="auto">{m.lead}</strong>
                    <span className={`cd-status st-${m.status === "scheduled" ? "active" : m.status === "completed" ? "completed" : "paused"}`}>{t.camp.meet[({ scheduled: "upcoming", completed: "past", no_show: "noShow", canceled: "canceled" } as const)[m.status as "scheduled"] ?? "upcoming"]}</span>
                    {m.confirmed && <span className="sdr-badge nodot green">{metric("confirmed")!.label[lang]}</span>}
                    <small>{formatDateTime(m.at, locale)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="ws-hint">{P.meetings.empty}</p>}
          <Link className="sdr-btn ghost sm" href="/meetings">{P.meetings.open}</Link>
        </section>
      )}

      {tab === "settings" && (
        <section className="cp-card">
          <div className="cp-card-head"><h3>{P.settings.title}</h3>{!["archived", "completed"].includes(c.status) && <Link className="sdr-btn sm" href={editHref}><Pencil />{P.settings.edit}</Link>}</div>
          <dl className="cp-settings">
            <dt>{P.budget}</dt><dd>{budget}</dd>
            <dt>{P.dates}</dt><dd>{dates}</dd>
            <dt>{P.settings.daily}</dt><dd>{c.dailyLimit ?? P.settings.none}</dd>
            <dt>{P.settings.days}</dt><dd>{c.runDays.length === 7 ? "–" : c.runDays.map((d) => t.ag.days[d as keyof typeof t.ag.days]).join(lang === "ar" ? "، " : ", ")}</dd>
            <dt>{P.settings.hours}</dt><dd dir="ltr">{c.contactFrom && c.contactTo ? `${c.contactFrom.slice(0, 5)}–${c.contactTo.slice(0, 5)}` : P.settings.none}</dd>
            <dt>{P.sender}</dt><dd dir="ltr">{c.mailbox ?? P.noSender}{c.senderName ? ` · ${c.senderName}` : ""}</dd>
            <dt>{P.settings.tone}</dt><dd>{t.ag.tones[c.tone as keyof typeof t.ag.tones] ?? c.tone}</dd>
            <dt>{P.settings.language}</dt><dd>{c.language === "mul" ? t.ag.builder.message.languageAuto : c.language.toUpperCase()}</dd>
            <dt>{P.settings.notes}</dt><dd dir="auto">{c.instructions || P.settings.none}</dd>
          </dl>
        </section>
      )}
    </div>
  );
}
