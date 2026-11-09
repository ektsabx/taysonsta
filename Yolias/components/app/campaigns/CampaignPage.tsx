"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, Copy, MoreHorizontal, Pencil, Square, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { countryLabel, formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { formatMetric, isObjective, metric, type Counts, type CustomMetricDef, type RangePreset } from "@/lib/campaigns/metrics";
import { deleteDraft, duplicateCampaign, runOutreach } from "@/app/(app)/campaigns/actions";
import { CampaignsManager } from "@/components/app/campaigns/CampaignsManager";
import type { CampaignLine } from "@/services/campaign-table";
import type { CampaignDetailData } from "@/services/campaign-detail";
import { activityText } from "@/lib/campaigns/activity-text";
import type { Learned } from "@/lib/agent-core/learning";

// A campaign from the inside (owner, 2026-11-02, D-274), like a campaign in
// an ads manager: the path back to Campaigns, the on/off switch, the results
// with the cost per result first (a meeting held is the result), a chart of
// the days, then the campaign's audiences (ad sets) and messages (ads) in
// the same table as Campaigns, with columns, a breakdown, export and the
// date range. Below: what Yolias did and recommends, the conversations, the
// meetings and the settings.

export type CampaignTab = "activity" | "conversations" | "meetings" | "settings";
const TABS: CampaignTab[] = ["activity", "conversations", "meetings", "settings"];
// D-274: each objective's result and cost per result first (a meetings campaign's result is a booked meeting).
const KPIS: Record<string, string[]> = {
  meetings: ["meetings", "cost_per_meeting", "spend", "found", "sent", "open_rate", "reply_rate", "held"],
  purchases: ["results", "cost_per_result", "conversion_value", "purchase_roas", "spend", "site_visits", "sent", "reply_rate"],
  form_leads: ["results", "cost_per_result", "spend", "site_visits", "found", "sent", "open_rate", "reply_rate"],
  qualified_leads: ["found", "cost_per_lead", "spend", "found_companies", "found_people"],
};

export interface CampaignInfo {
  id: string; name: string; status: CampaignLine["status"]; budgetUsd: number | null; budgetType: "total" | "daily" | "monthly" | null;
  startsAt: string | null; endsAt: string | null; mailbox: string | null; targetMeetings: number | null; dailyLimit: number | null; runDays: string[]; contactFrom: string | null; contactTo: string | null;
  tone: string; language: string; instructions: string | null; senderName: string | null; approved: boolean;
  /** D-274 */
  costCapUsd: number | null; trackOpens: boolean; optimizingFor: string | null; objective: string;
}

export function CampaignPage({ c, tab, range, from, to, line, prev, detail, activity, recommendations, learned = [], refreshedAt, custom = [] }: {
  c: CampaignInfo; tab: CampaignTab; range: RangePreset; from: string; to: string; line: CampaignLine; prev: Counts | null; detail: CampaignDetailData;
  activity: { id: number; kind: string; body: string; at: string; meta?: unknown }[]; recommendations: string[]; learned?: Learned[]; refreshedAt: string; custom?: CustomMetricDef[];
}) {
  const { t, locale } = useI18n();
  const P = t.ag.page;
  const C = t.ag.rx.cp;
  const O = t.ag.rx.opt;
  const lang = locale === "ar" ? "ar" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const [chart, setChart] = useState(true);
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
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".cp-more")) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "14d" ? 14 : 0;
  const draft = c.status === "draft";
  const live = c.status === "active" || c.status === "scheduled";
  const editHref = draft ? `/campaigns/new?draft=${c.id}` : `/campaigns/${c.id}/edit`;
  const budget = c.budgetUsd == null ? "–" : fmt(c.budgetType === "daily" ? P.perDay : P.total, { usd: usd(c.budgetUsd) });
  const dates = c.startsAt ? (c.endsAt ? fmt(P.fromTo, { from: formatDate(c.startsAt, locale), to: formatDate(c.endsAt, locale) }) : fmt(P.fromOpen, { from: formatDate(c.startsAt, locale) })) : "–";
  const daily = detail.breakdowns.day;
  // One scale for the three series, so the bars compare honestly.
  const peak = Math.max(1, ...daily.map((d) => Math.max(d.sent, d.replies, d.held)));
  const on = live;
  const canSwitch = on || (c.status === "paused" && c.approved);
  const learning = line.groups.some((g) => g.status === "active" && g.learning);

  return (
    <div className="sdr-page cp">
      <nav className="cp-crumbs" aria-label={t.ag.manager.title}>
        <Link href="/campaigns"><ChevronLeft className="flip-rtl" />{t.ag.manager.title}</Link>
        <span aria-hidden>/</span>
        <span dir="auto">{c.name}</span>
      </nav>
      <header className="cp-head">
        <div className="cp-title">
          <button type="button" role="switch" aria-checked={on} aria-label={`${C.toggle}: ${c.name}`} className={`cm-sw${on ? " on" : ""}`} disabled={!canSwitch || pending}
            onClick={() => run(() => runOutreach(c.id, on ? "pause" : "resume"))}><i /></button>
          <h2 dir="auto">{c.name}</h2>
          <span className={`cd-status st-${c.status}`}>{t.ag.status[c.status]}</span>
          {live && <span className="cp-opt">{c.optimizingFor ? fmt(O.optimizing, { event: O.events[c.optimizingFor as keyof typeof O.events] ?? c.optimizingFor }) : learning ? O.learning : ""}</span>}
        </div>
        <div className="cp-actions">
          {!["archived", "completed"].includes(c.status) && <Link className="sdr-btn" href={editHref}><Pencil />{draft ? P.continueDraft : P.edit}</Link>}
          <div className="cp-more cm-wrap">
            <button type="button" className="sdr-btn" aria-expanded={menu} aria-label={C.more} onClick={() => setMenu((x) => !x)}><MoreHorizontal /></button>
            {menu && (
              <div className="cm-menu" role="menu">
                <button role="menuitem" type="button" disabled={pending} onClick={() => run(() => duplicateCampaign(c.id), (r) => router.push(`/campaigns/new?draft=${(r as unknown as { id: string }).id}`))}><Copy />{P.duplicate}</button>
                {(live || c.status === "paused") && <button role="menuitem" type="button" disabled={pending} onClick={() => { if (confirm(P.endConfirm)) run(() => runOutreach(c.id, "end")); }}><Square />{P.end}</button>}
                {!draft && c.status !== "archived" && <button role="menuitem" type="button" disabled={pending} onClick={() => { if (confirm(P.archiveConfirm)) run(() => runOutreach(c.id, "cancel")); }}>{P.archive}</button>}
                {draft && <button role="menuitem" type="button" className="danger" disabled={pending} onClick={() => { if (confirm(P.deleteConfirm)) run(() => deleteDraft(c.id), () => router.push("/campaigns")); }}><Trash2 />{P.deleteDraft}</button>}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="cp-kpis">
        {(KPIS[c.objective] ?? KPIS.meetings).map((id, i) => {
          const m = metric(id)!;
          const v = m.compute(line.counts), before = prev ? m.compute(prev) : null;
          const delta = v != null && before != null && before !== 0 ? (v - before) / before : null;
          const lead = i < 2;
          const good = id.startsWith("cost_per") || id === "spend" ? (delta ?? 0) < 0 : (delta ?? 0) > 0;
          return (
            <div key={id} className={`cp-kpi${lead ? " lead" : ""}`}>
              <span className="cp-kpi-label">{i === 0 ? C.results : i === 1 ? C.costPerResult : m.label[lang]}</span>
              <strong>{formatMetric(v, m.format, lang)}</strong>
              <small>{lead ? m.label[lang] : delta != null && days ? <span className={good ? "up" : "down"}>{good ? <ArrowUpRight /> : <ArrowDownRight />}{`${Math.abs(Math.round(delta * 100))}%`} {fmt(P.vsPrevious, { days: String(days) })}</span> : " "}</small>
            </div>
          );
        })}
      </div>

      <section className="cp-card wide">
        <div className="cp-card-head">
          <h3>{C.chart}</h3>
          <button type="button" className="sdr-btn ghost sm" onClick={() => setChart((x) => !x)}>{chart ? C.hideChart : C.showChart}</button>
        </div>
        {chart && (daily.length ? (
          <>
            <div className="cp-bars" role="img" aria-label={C.chart}>
              {daily.slice(-30).map((d) => (
                <div key={d.key} className="cp-bar" title={`${d.key}: ${d.sent} · ${d.replies} · ${d.held}`}>
                  <span className="s" style={{ height: `${(d.sent / peak) * 100}%` }} />
                  <span className="r" style={{ height: `${(d.replies / peak) * 100}%` }} />
                  <span className="m" style={{ height: `${(d.held / peak) * 100}%` }} />
                  <small>{d.key.slice(8)}</small>
                </div>
              ))}
            </div>
            <p className="cp-legend"><i className="s" />{metric("sent")!.label[lang]} <i className="r" />{metric("replies")!.label[lang]} <i className="m" />{metric("held")!.label[lang]}</p>
          </>
        ) : <p className="ws-hint">{t.ag.manager.noMessages}</p>)}
      </section>

      {/* Today's split between audiences (owner, 2026-11-03): the optimizer's daily shares. */}
      {line.groups.some((g) => g.status === "active") && (
        <section className="cp-card wide">
          <div className="cp-card-head"><h3>{O.splitTitle}</h3></div>
          <ul className="cp-split">
            {line.groups.filter((g) => g.status === "active").map((g) => {
              const active = line.groups.filter((x) => x.status === "active").length;
              const share = g.share ?? 1 / active;
              const reason = g.opt?.reason as keyof typeof O.reasons | undefined;
              return (
                <li key={g.id}>
                  <span className="cp-split-name" dir="auto">{g.name}</span>
                  <span className="cp-split-bar"><i style={{ width: `${Math.round(share * 100)}%` }} /></span>
                  <b>{Math.round(share * 100)}%</b>
                  <small>{g.share == null || g.learning ? O.reasons.learning : reason ? O.reasons[reason] : ""}</small>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <CampaignsManager lines={[line]} members={[]} range={range} from={from} to={to} refreshedAt={refreshedAt} scope={{ campaignId: c.id, editHref }} breakdowns={detail.breakdowns} custom={custom} objective={isObjective(c.objective) ? c.objective : "meetings"} />

      <nav className="cp-tabs" role="tablist">
        {TABS.map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => go("tab", k === "activity" ? null : k)}>{k === "activity" ? P.activity : P.tabs[k]}</button>)}
      </nav>

      {tab === "activity" && (
        <div className="cp-grid">
          <section className="cp-card">
            <h3>{P.activity}</h3>
            {activity.length ? (
              <ul className="cp-activity">{activity.map((a) => <li key={a.id}><span dir="auto">{activityText(a, lang, t.ag.act)}</span><small>{formatDateTime(a.at, locale)}</small></li>)}</ul>
            ) : <p className="ws-hint">{P.activityEmpty}</p>}
          </section>
          <section className="cp-card">
            <h3>{P.learned.title}</h3>
            {learned.length ? (
              <>
                <ul className="cp-list">{learned.map((f) => (
                  <li key={f.dim + f.best.value}>{fmt(P.learned.line, {
                    label: P.learned.dims[f.dim], value: f.dim === "country" ? countryLabel(f.best.value, locale) : f.best.value,
                    a: `${Math.round(f.best.rate * 100)}%`, b: `${Math.round(f.other.rate * 100)}%`, n: String(f.best.n), metric: P.learned[f.metric],
                  })}</li>
                ))}</ul>
                <p className="ws-hint">{P.learned.foot}</p>
              </>
            ) : <p className="ws-hint">{P.learned.empty}</p>}
          </section>
          <section className="cp-card">
            <h3>{P.recommendations}</h3>
            {recommendations.length ? <ul className="cp-list">{recommendations.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="ws-hint">{P.noRecommendations}</p>}
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
        </section>
      )}

      {tab === "meetings" && (
        <section className="cp-card">
          {detail.meetings.length ? (
            <ul className="cp-convs">
              {detail.meetings.map((m) => (
                <li key={m.id}>
                  <Link href="/meetings?tab=bookings">
                    <strong dir="auto">{m.lead}</strong>
                    <span className={`cd-status st-${m.status === "scheduled" ? "active" : m.status === "completed" ? "completed" : "paused"}`}>{t.camp.meet[({ scheduled: "upcoming", completed: "past", no_show: "noShow", canceled: "canceled" } as const)[m.status as "scheduled"] ?? "upcoming"]}</span>
                    {m.confirmed && <span className="sdr-badge nodot green">{metric("confirmed")!.label[lang]}</span>}
                    <small>{formatDateTime(m.at, locale)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="ws-hint">{P.meetings.empty}</p>}
          <Link className="sdr-btn ghost sm" href="/meetings?tab=bookings">{P.meetings.open}</Link>
        </section>
      )}

      {tab === "settings" && (
        <section className="cp-card">
          <div className="cp-card-head"><h3>{P.settings.title}</h3>{!["archived", "completed"].includes(c.status) && <Link className="sdr-btn sm" href={editHref}><Pencil />{P.settings.edit}</Link>}</div>
          <dl className="cp-settings">
            <dt>{t.ag.builder.campaign.objective}</dt><dd>{t.ag.rx.build.objectives[c.objective as keyof typeof t.ag.rx.build.objectives] ?? P.objective}{c.targetMeetings && c.objective === "meetings" ? ` · ${fmt(P.target, { got: String(line.counts.held), target: String(c.targetMeetings) })}` : ""}</dd>
            <dt>{P.budget}</dt><dd>{budget}</dd>
            <dt>{O.costCap}</dt><dd>{c.costCapUsd == null ? O.noCap : usd(c.costCapUsd)}</dd>
            <dt>{P.dates}</dt><dd>{dates}</dd>
            <dt>{P.settings.daily}</dt><dd>{c.dailyLimit ?? P.settings.none}</dd>
            <dt>{P.settings.days}</dt><dd>{c.runDays.length === 7 ? "–" : c.runDays.map((d) => t.ag.days[d as keyof typeof t.ag.days]).join(lang === "ar" ? "، " : ", ")}</dd>
            <dt>{P.settings.hours}</dt><dd dir="ltr">{c.contactFrom && c.contactTo ? `${c.contactFrom.slice(0, 5)}–${c.contactTo.slice(0, 5)}` : P.settings.none}</dd>
            <dt>{P.sender}</dt><dd dir="ltr">{c.mailbox ?? P.noSender}{c.senderName ? ` · ${c.senderName}` : ""}</dd>
            <dt>{O.trackOpens}</dt><dd>{c.trackOpens ? "✓" : "–"}</dd>
            <dt>{P.settings.tone}</dt><dd>{t.ag.tones[c.tone as keyof typeof t.ag.tones] ?? c.tone}</dd>
            <dt>{P.settings.language}</dt><dd>{c.language === "mul" ? t.ag.builder.message.languageAuto : c.language.toUpperCase()}</dd>
            <dt>{P.settings.notes}</dt><dd dir="auto">{c.instructions || P.settings.none}</dd>
          </dl>
        </section>
      )}
    </div>
  );
}
