"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowDown, ArrowUp, ChevronDown, ChevronLeft, Copy, Download, Loader2, MoreHorizontal, Pause, Pencil, Play, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { countryLabel, formatNumber } from "@/lib/format";
import { useRun } from "@/components/app/ws/bits";
import { LiveRefresh } from "@/components/app/LiveRefresh";
import { LaunchPanel, type MailboxOption } from "@/components/app/ws/LaunchPanel";
import { METRICS, RANGE_PRESETS, formatMetric, metric, type Counts, type RangePreset } from "@/lib/campaigns/metrics";
import { channelSpec } from "@/lib/campaigns/channels";
import { emptyGroup, type WizardGroup } from "@/lib/campaigns/wizard";
import type { Targeting } from "@/lib/campaigns/targeting";
import { duplicateCampaign, removeEnrollment, runOutreach, writeNextEmails } from "@/app/(app)/outreach/actions";
import { bulkCampaigns } from "@/app/(app)/outreach/manager-actions";
import { addGroup, groupAction, saveGroupSteps, updateCampaignSettings } from "@/app/(app)/outreach/[id]/actions";
import { TargetingEditor, targetingSummary } from "./TargetingEditor";
import type { CampaignLine } from "@/services/campaign-table";
import type { CampaignMetrics } from "@/services/campaign-metrics";
import type { CampaignDetailData, Dimension } from "@/services/campaign-detail";
import type { LaunchSummary } from "@/services/outreach-campaigns";
import type { CampaignObjective } from "@/types/acquisition";

// A campaign's page (owner, 2026-10-31, D-272), after an ad campaign in Ads
// Manager: the header (objective, channel, budget, dates, owner, actions),
// the one-time approval while it's a draft, then nine tabs. Every number is
// counted from real rows for the chosen period; plans and forecasts are
// labelled as estimates; recommendations come from the numbers only.

export type CampaignTab = "overview" | "groups" | "sequences" | "messages" | "prospects" | "conversations" | "meetings" | "performance" | "settings";
const TABS: CampaignTab[] = ["overview", "groups", "sequences", "messages", "prospects", "conversations", "meetings", "performance", "settings"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const OBJECTIVES: CampaignObjective[] = ["meetings", "leads", "opportunities", "new_customers", "reactivate", "promote", "custom"];

export interface CampaignInfo {
  id: string; name: string; status: CampaignLine["status"]; objective: CampaignObjective; description: string; ctaUrl: string; channels: string[];
  budgetUsd: number | null; budgetType: "total" | "daily" | "monthly" | null; startDate: string; startTime: string; endDate: string; endTime: string; timezone: string;
  runDays: string[]; contactFrom: string; contactTo: string; dailyLimit: number; targetMeetings: number; ownerId: string | null; approved: boolean; createdAt: string;
}
export interface GroupInfo { id: string; name: string; status: "active" | "paused" | "archived"; source: WizardGroup["source"]; targeting: Targeting; angleA: string; angleB: string; steps: WizardGroup["steps"] }

export function CampaignPage(p: {
  tab: CampaignTab; range: RangePreset; from: string; to: string;
  c: CampaignInfo; line: CampaignLine; prev: Counts | null; engine: CampaignMetrics | null; recommendations: string[];
  groups: GroupInfo[]; detail: CampaignDetailData; activity: { id: number; kind: string; body: string; at: string }[];
  launch: LaunchSummary; mailboxes: MailboxOption[]; mailboxName: string | null; workspaceDailyLimit: number; toWrite: number; totalLeads: number;
  members: { id: string; name: string }[]; zones: { value: string; label: string }[]; rate: number; timeZone: string | null;
}) {
  const { t, locale } = useI18n();
  const d = t.camp.detail;
  const lang = locale === "ar" ? "ar" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { run, pending } = useRun();
  const [more, setMore] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const c = p.c;
  const n = (v: number) => formatNumber(v, locale);
  const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  const when = (iso: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", ...(p.timeZone ? { timeZone: p.timeZone } : {}) }).format(new Date(iso));
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) q.set(k, v); else q.delete(k); }
    return `${pathname}${q.size ? `?${q}` : ""}`;
  };
  const archived = c.status === "archived" || c.status === "completed";
  const owner = p.members.find((m) => m.id === c.ownerId)?.name ?? "";

  // Yolias writes the first emails while the page is open, a couple at a time (D-239).
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!p.mailboxes.length || archived || !p.toWrite || started.current) return;
    started.current = true;
    let stop = false;
    (async () => {
      setWriting(true);
      for (let i = 0; i < 300 && !stop; i++) {
        const r = await writeNextEmails(c.id).catch(() => null);
        if (stop) break;
        if (!r || !r.ok) { setWriteError(r && !r.ok ? r.error : t.ws.common.error); break; }
        router.refresh();
        if (r.remaining === 0) break;
      }
      setWriting(false);
      started.current = false;
    })();
    return () => { stop = true; };
  }, [p.mailboxes.length, archived, p.toWrite, c.id, router, t.ws.common.error]);

  return (
    <div className="sdr-page cp">
      <div><Link className="sdr-back" href="/outreach"><ChevronLeft className="flip-rtl" />{t.camp.manager.title}</Link></div>
      <header className="cp-head">
        <div className="cp-title">
          <h2 dir="auto">{c.name}</h2>
          <span className={`cd-status st-${c.status}`}>{t.camp.status[c.status]}</span>
        </div>
        <div className="sdr-head-actions">
          <Link className="sdr-btn" href={href({ tab: "settings" })}><Pencil />{d.edit}</Link>
          {c.status === "active" && <button type="button" className="sdr-btn" disabled={pending} onClick={() => run(() => runOutreach(c.id, "pause"))}><Pause />{t.camp.manager.pause}</button>}
          {c.status === "paused" && c.approved && <button type="button" className="sdr-btn primary" disabled={pending} onClick={() => run(() => runOutreach(c.id, "resume"))}><Play />{t.camp.manager.resume}</button>}
          <button type="button" className="sdr-btn" disabled={pending} onClick={() => run(() => duplicateCampaign(c.id), { onOk: (r) => router.push(`/outreach/${(r as unknown as { id: string }).id}`), refresh: false })}><Copy />{t.camp.manager.duplicate}</button>
          <div className="cm-wrap">
            <button type="button" className="sdr-btn cm-toggle" aria-expanded={more} onClick={() => setMore((x) => !x)}><MoreHorizontal />{d.more}</button>
            {more && (
              <div className="cm-menu" role="menu">
                {!archived && <button role="menuitem" type="button" onClick={() => { setMore(false); if (confirm(t.camp.perf.endConfirm)) run(() => runOutreach(c.id, "end")); }}>{d.endCampaign}</button>}
                {c.status !== "archived" && <button role="menuitem" type="button" onClick={() => { setMore(false); if (confirm(fmt(t.camp.manager.confirmArchive, { n: "1" }))) run(() => bulkCampaigns([c.id], "archive")); }}>{d.archive}</button>}
                {c.status === "draft" && <button role="menuitem" type="button" className="danger" onClick={() => { setMore(false); if (confirm(fmt(t.camp.manager.confirmDelete, { n: "1" }))) run(() => bulkCampaigns([c.id], "delete"), { onOk: () => router.push("/outreach") }); }}>{d.delete}</button>}
              </div>
            )}
          </div>
        </div>
      </header>
      <dl className="cp-facts">
        <div><dt>{d.objective}</dt><dd>{t.camp.manager.objectives[c.objective]}</dd></div>
        <div><dt>{d.channel}</dt><dd>{c.channels.map((x) => channelSpec(x)?.label[lang] ?? x).join(" + ")}</dd></div>
        <div><dt>{d.budget}</dt><dd>{c.budgetUsd != null ? `${usd(c.budgetUsd)} · ${t.camp.wiz.budget.types[c.budgetType ?? "total"]}` : d.none}</dd></div>
        <div><dt>{d.start}</dt><dd>{c.startDate ? `${c.startDate} ${c.startTime}` : d.none}</dd></div>
        <div><dt>{d.end}</dt><dd>{c.endDate ? `${c.endDate} ${c.endTime}` : d.noEnd}</dd></div>
        {owner && <div><dt>{d.owner}</dt><dd>{owner}</dd></div>}
      </dl>

      {!archived && !c.approved && (
        !p.mailboxes.length ? (
          <section className="sdr-panel"><div className="sdr-panel-body pad cp-row">
            <div><div className="sdr-panel-title">{t.ws.outreach.workspace.noMailboxTitle}</div><div className="sdr-panel-sub">{t.ws.outreach.workspace.noMailbox}</div></div>
            <Link className="sdr-btn primary" href="/integrations">{t.ws.outreach.workspace.connect}</Link>
          </div></section>
        ) : p.totalLeads > 0 ? <LaunchPanel summary={p.launch} mailboxes={p.mailboxes} mailboxName={p.mailboxName} dailyLimit={p.workspaceDailyLimit} /> : null
      )}
      {(writing || writeError) && (
        <div className={`ow-progress${writeError ? " error" : ""}`} role="status">
          {writeError ? <AlertCircle /> : <Loader2 className="spin" />}
          <span>{writeError ?? fmt(t.ws.outreach.workspace.writing, { done: p.totalLeads - p.toWrite, total: p.totalLeads })}</span>
        </div>
      )}
      <LiveRefresh active={c.status === "active" && c.approved} seconds={20} />

      <div className="cp-bar">
        <nav className="sdr-tabs cp-tabs" aria-label={c.name}>
          {TABS.map((k) => <Link key={k} href={href({ tab: k === "overview" ? null : k })} className={p.tab === k ? "active" : ""} aria-current={p.tab === k ? "page" : undefined}>{d.tabs[k]}</Link>)}
        </nav>
        {!["settings", "groups", "sequences"].includes(p.tab) && (
          <div className="cm-wrap">
            <button type="button" className="sdr-btn sm cm-toggle" onClick={() => setRangeOpen((x) => !x)}>{t.camp.manager.ranges[p.range]}{p.range === "custom" && p.from ? ` · ${p.from} – ${p.to}` : ""}<ChevronDown /></button>
            {rangeOpen && <div className="cm-pop cm-range cp-range">{RANGE_PRESETS.filter((r) => r !== "custom").map((r) => <Link key={r} href={href({ range: r === "lifetime" ? null : r, from: null, to: null })} className={r === p.range ? "on" : ""} onClick={() => setRangeOpen(false)}>{t.camp.manager.ranges[r]}</Link>)}</div>}
          </div>
        )}
      </div>

      {p.tab === "overview" && <Overview {...p} n={n} when={when} />}
      {p.tab === "groups" && <Groups {...p} n={n} />}
      {p.tab === "sequences" && <Sequences groups={p.groups} />}
      {p.tab === "messages" && <Messages detail={p.detail} when={when} n={n} />}
      {p.tab === "prospects" && <People detail={p.detail} campaignId={c.id} />}
      {p.tab === "conversations" && <Conversations detail={p.detail} campaignId={c.id} when={when} />}
      {p.tab === "meetings" && <Meetings detail={p.detail} when={when} />}
      {p.tab === "performance" && <Performance detail={p.detail} n={n} />}
      {p.tab === "settings" && <Settings c={c} members={p.members} zones={p.zones} rate={p.rate} />}
    </div>
  );
}

function Overview(p: Parameters<typeof CampaignPage>[0] & { n: (v: number) => string; when: (iso: string) => string }) {
  const { t, locale } = useI18n();
  const d = t.camp.detail;
  const lang = locale === "ar" ? "ar" : "en";
  const ids = ["contacted", "replies", "interested", "meetings", "spend"];
  const e = p.engine;
  return (
    <div className="cp-grid">
      <div className="cp-kpis">
        {ids.map((id) => {
          const m = metric(id)!; const v = m.compute(p.line.counts); const prev = p.prev ? m.compute(p.prev) : null;
          const delta = v != null && prev != null && prev > 0 ? (v - prev) / prev : null;
          return (
            <div key={id} className="cp-kpi">
              <span>{m.label[lang]}</span><strong>{formatMetric(v, m.format, lang)}</strong>
              <small>{delta == null ? (p.prev ? d.noPrevious : "") : <>{delta >= 0 ? <ArrowUp /> : <ArrowDown />}{Math.abs(Math.round(delta * 100))}% {d.vsPrevious}</>}</small>
            </div>
          );
        })}
      </div>
      <section className="sdr-panel"><div className="sdr-panel-body pad">
        <div className="sdr-panel-title">{d.recommendations}</div>
        {p.recommendations.length ? <ul className="cp-recs">{p.recommendations.map((r) => <li key={r} dir="auto">{r}</li>)}</ul> : <p className="ws-hint">{d.noRecommendations}</p>}
        {e && (
          <div className="cp-est">
            <span className="cd-badge">{t.camp.kinds.forecast}</span>
            <p>{e.plan ? fmt(t.camp.perf.planLine, { n: p.n(e.plan.contactsNeeded), perDay: p.n(e.plan.perDay) }) : t.camp.perf.planNone}</p>
            <p>{e.forecast ? fmt(t.camp.perf.forecastLine, { low: p.n(e.forecast.low), high: p.n(e.forecast.high), mid: p.n(e.forecast.mid) }) : t.camp.perf.forecastNone}</p>
            {e.target ? <p>{t.camp.kinds.target}: {p.n(e.target)} · <span className={`cd-pace pace-${e.pace}`}>{t.camp.pace[e.pace]}</span></p> : null}
          </div>
        )}
      </div></section>
      <section className="sdr-panel"><div className="sdr-panel-body pad">
        <div className="sdr-panel-title">{d.byGroup}</div>
        <MiniTable rows={p.line.groups.map((g) => ({ key: g.name, counts: g.counts }))} />
        <div className="sdr-panel-title cp-sub">{d.byChannel}</div>
        <MiniTable rows={p.c.channels.map((ch) => ({ key: channelSpec(ch)?.label[lang] ?? ch, counts: p.line.counts }))} />
      </div></section>
      <section className="sdr-panel"><div className="sdr-panel-body pad">
        <div className="sdr-panel-title">{t.camp.perf.activity}</div>
        {p.activity.length ? <ul className="cd-activity cr-activity">{p.activity.map((a) => <li key={a.id}><time>{p.when(a.at)}</time><span dir="auto">{a.body}</span></li>)}</ul> : <p className="ws-hint">{t.camp.perf.activityEmpty}</p>}
      </div></section>
    </div>
  );
}

function MiniTable({ rows }: { rows: { key: string; counts: Counts }[] }) {
  const { t, locale } = useI18n();
  const lang = locale === "ar" ? "ar" : "en";
  const cols = ["contacted", "replies", "interested", "meetings", "spend"].map((id) => metric(id)!);
  return (
    <div className="cd-table-wrap"><table className="cd-table">
      <thead><tr><th>{t.camp.groups.colName}</th>{cols.map((c) => <th key={c.id}>{c.label[lang]}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key}><td dir="auto">{r.key}</td>{cols.map((c) => <td key={c.id}>{formatMetric(c.compute(r.counts), c.format, lang)}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

function Groups(p: Parameters<typeof CampaignPage>[0] & { n: (v: number) => string }) {
  const { t, locale } = useI18n();
  const d = t.camp.detail;
  const lang = locale === "ar" ? "ar" : "en";
  const { run, pending } = useRun();
  const [adding, setAdding] = useState(false);
  const [g, setG] = useState<WizardGroup>(() => emptyGroup(p.groups.length, `${t.camp.groups.name} ${p.groups.length + 1}`));
  const [prospects, setProspects] = useState(100);
  const cols = ["contacted", "replies", "interested", "meetings", "spend"].map((id) => metric(id)!);
  const counts = new Map(p.line.groups.map((x) => [x.id, x.counts]));
  return (
    <section className="sdr-panel"><div className="sdr-panel-body pad cp-groups">
      <div className="cp-row"><div className="sdr-panel-title">{t.camp.groups.title}</div>
        {!["archived", "completed"].includes(p.c.status) && <button type="button" className="sdr-btn" onClick={() => setAdding((x) => !x)}><Plus />{d.addGroup}</button>}</div>
      {!p.groups.length ? <p className="ws-hint">{d.groupsEmpty}</p> : (
        <div className="cd-table-wrap"><table className="cd-table">
          <thead><tr><th>{t.camp.groups.colName}</th><th>{t.camp.manager.colStatus}</th><th>{t.camp.wiz.audience.source}</th>{cols.map((c) => <th key={c.id}>{c.label[lang]}</th>)}<th /></tr></thead>
          <tbody>{p.groups.map((x) => (
            <tr key={x.id}>
              <td><span className="cm-name-cell"><strong dir="auto">{x.name}</strong><small dir="auto">{targetingSummary(x.targeting, lang, (c) => countryLabel(c, locale)).slice(0, 2).join(" · ")}</small></span></td>
              <td><span className={`cd-status st-${x.status}`}>{t.camp.groups.status[x.status]}</span></td>
              <td>{t.camp.groups.sources[x.source]}</td>
              {cols.map((c) => <td key={c.id}>{formatMetric(c.compute(counts.get(x.id) ?? zero()), c.format, lang)}</td>)}
              <td className="cp-actions">
                {x.status === "active" && <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => run(() => groupAction(x.id, "pause"))}>{t.camp.groups.pause}</button>}
                {x.status === "paused" && <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => run(() => groupAction(x.id, "resume"))}>{t.camp.groups.resume}</button>}
                <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => run(() => groupAction(x.id, "duplicate"))}>{t.camp.groups.duplicate}</button>
                {x.status !== "archived" && <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => run(() => groupAction(x.id, "archive"))}>{t.camp.groups.archive}</button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {adding && (
        <div className="cp-add">
          <h4>{d.addGroupTitle}</h4>
          <div className="ws-grid-2">
            <label className="ws-field"><span className="ws-label">{t.camp.wiz.audience.name}</span><input className="form-input" dir="auto" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></label>
            <label className="ws-field"><span className="ws-label">{d.prospects}</span><input className="form-input" type="number" min={10} value={prospects} onChange={(e) => setProspects(Math.max(0, Number(e.target.value) || 0))} /></label>
          </div>
          <TargetingEditor value={g.targeting as Targeting} onChange={(tg) => setG({ ...g, targeting: tg as never })} />
          <label className="ws-field"><span className="ws-label">{t.camp.wiz.plan.angleA}</span><textarea className="form-input" rows={2} dir="auto" value={g.angleA} onChange={(e) => setG({ ...g, angleA: e.target.value })} /></label>
          <label className="ws-field"><span className="ws-label">{t.camp.wiz.plan.angleB}</span><textarea className="form-input" rows={2} dir="auto" value={g.angleB} onChange={(e) => setG({ ...g, angleB: e.target.value })} /></label>
          <button type="button" className="sdr-btn primary" disabled={pending || !g.name.trim() || !g.angleA.trim()} onClick={() => run(() => addGroup(p.c.id, g, prospects), { onOk: () => setAdding(false) })}>{d.startGroup}</button>
        </div>
      )}
    </div></section>
  );
}
const zero = (): Counts => ({ found: 0, contacted: 0, sent: 0, delivered: 0, bounced: 0, replies: 0, interested: 0, meetingRequests: 0, meetings: 0, held: 0, qualified: 0, customers: 0, revenueUsd: 0, spendUsd: 0, prospectsUsed: 0 });

function Sequences({ groups }: { groups: GroupInfo[] }) {
  const { t } = useI18n();
  const d = t.camp.detail;
  const w = t.camp.wiz.plan;
  const { run, pending } = useRun();
  const [steps, setSteps] = useState<Record<string, WizardGroup["steps"]>>(() => Object.fromEntries(groups.map((g) => [g.id, g.steps])));
  if (!groups.length) return <p className="ws-hint">{d.seqEmpty}</p>;
  return (
    <div className="cp-grid">
      {groups.map((g) => {
        const list = steps[g.id] ?? [];
        const set = (l: WizardGroup["steps"]) => setSteps((s) => ({ ...s, [g.id]: l }));
        return (
          <section key={g.id} className="sdr-panel"><div className="sdr-panel-body pad">
            <div className="sdr-panel-title" dir="auto">{fmt(d.groupSeq, { name: g.name })}</div>
            <ol className="wz-seq cp-seq">{list.map((st, k) => (
              <li key={k}>
                <span>{fmt(w.step, { n: String(k + 1) })} · {k === 0 ? w.first : w.followUp}{k > 0 ? ` · ${fmt(w.day, { n: String(list.slice(1, k + 1).reduce((a, x) => a + x.delayDays, 0)) })}` : ""}</span>
                {k > 0 && <input className="sdr-input sm" type="number" min={1} max={60} aria-label={w.day} value={st.delayDays} onChange={(e) => set(list.map((y, j) => (j === k ? { ...y, delayDays: Math.max(1, Number(e.target.value) || 1) } : y)))} />}
                <input className="sdr-input sm wz-ins" dir="auto" maxLength={500} placeholder={w.instruction} value={st.instruction} onChange={(e) => set(list.map((y, j) => (j === k ? { ...y, instruction: e.target.value } : y)))} />
                {k > 0 && <button type="button" className="sdr-btn sm" onClick={() => set(list.filter((_, j) => j !== k))}>{w.removeStep}</button>}
              </li>
            ))}</ol>
            <div className="wz-row">
              {list.length < 5 && <button type="button" className="sdr-btn sm" onClick={() => set([...list, { delayDays: 4, objective: "follow_up", instruction: "" }])}><Plus />{w.addStep}</button>}
              <button type="button" className="sdr-btn sm primary" disabled={pending || !list.length} onClick={() => run(() => saveGroupSteps(g.id, list))}>{d.saveSteps}</button>
            </div>
            {g.angleA && <p className="ws-hint" dir="auto"><strong>{w.angleA}:</strong> {g.angleA}</p>}
            {g.angleB && <p className="ws-hint" dir="auto"><strong>{w.angleB}:</strong> {g.angleB}</p>}
            <p className="ws-hint">{w.stops}</p>
          </div></section>
        );
      })}
    </div>
  );
}

function Messages({ detail, when, n }: { detail: CampaignDetailData; when: (iso: string) => string; n: (v: number) => string }) {
  const { t } = useI18n();
  const d = t.camp.detail;
  const variants = detail.breakdowns.variant.filter((r) => r.key === "A" || r.key === "B");
  return (
    <div className="cp-grid">
      {variants.length > 0 && (
        <section className="sdr-panel"><div className="sdr-panel-body pad">
          <div className="sdr-panel-title">{d.variants}</div>
          <ul className="cp-recs">{variants.map((v) => <li key={v.key}>{fmt(d.variantRow, { v: v.key, sent: n(v.contacted), replies: n(v.replies), positive: n(v.interested) })}</li>)}</ul>
        </div></section>
      )}
      <section className="sdr-panel"><div className="sdr-panel-body pad">
        {!detail.messages.length ? <p className="ws-hint">{d.msgEmpty}</p> : (
          <div className="cd-table-wrap"><table className="cd-table">
            <thead><tr><th>{d.colLead}</th><th>{d.colSubject}</th><th>{d.colStep}</th><th>{d.colVariant}</th><th>{d.colStatus}</th><th>{d.colDate}</th></tr></thead>
            <tbody>{detail.messages.map((m) => (
              <tr key={m.id}><td><Link href={`/inbox?lead=${m.leadId}`} dir="auto">{m.lead}</Link></td><td dir="auto" className="cp-wrap">{m.subject}</td><td>{m.step ?? "–"}</td><td>{m.variant?.toUpperCase() ?? "–"}</td>
                <td>{m.deliveryStatus === "bounced" ? t.camp.detail.colBounced : t.ws.outreach.status?.[m.status as keyof typeof t.ws.outreach.status] ?? m.status}</td><td>{when(m.at)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div></section>
    </div>
  );
}

function People({ detail, campaignId }: { detail: CampaignDetailData; campaignId: string }) {
  const { t, locale } = useI18n();
  const d = t.camp.detail;
  const { run, pending } = useRun();
  const [q, setQ] = useState("");
  const rows = detail.people.filter((x) => !q || `${x.name} ${x.company ?? ""} ${x.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = [d.colLead, d.colCompany, "Email", d.colTitle, d.colCountry, d.colGroup, d.colStage, d.colInCampaign];
    const body = rows.map((x) => [x.name, x.company ?? "", x.email ?? "", x.title ?? "", x.country ?? "", x.group ?? "", t.ws.stages[x.stage as keyof typeof t.ws.stages] ?? x.stage, t.ws.outreach.enrollStatus[x.status as keyof typeof t.ws.outreach.enrollStatus] ?? x.status].map(esc).join(","));
    const blob = new Blob([`﻿${[head.map(esc).join(","), ...body].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `campaign-${campaignId.slice(0, 8)}-people.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section className="sdr-panel"><div className="sdr-panel-body pad">
      <div className="cp-row"><label className="cm-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.camp.manager.search} /></label>
        <button type="button" className="sdr-btn" disabled={!rows.length} onClick={exportCsv}><Download />{d.exportPeople}</button></div>
      {!rows.length ? <p className="ws-hint">{d.peopleEmpty}</p> : (
        <div className="cd-table-wrap"><table className="cd-table">
          <thead><tr><th>{d.colLead}</th><th>{d.colCompany}</th><th>{d.colTitle}</th><th>{d.colCountry}</th><th>{d.colGroup}</th><th>{d.colStage}</th><th>{d.colInCampaign}</th><th /></tr></thead>
          <tbody>{rows.map((x) => (
            <tr key={x.leadId}><td><Link href={`/inbox?lead=${x.leadId}`} dir="auto">{x.name}</Link></td><td dir="auto">{x.company ?? "–"}</td><td dir="auto">{x.title ?? "–"}</td><td>{x.country ? countryLabel(x.country, locale) : "–"}</td>
              <td dir="auto">{x.group ?? "–"}</td><td>{t.ws.stages[x.stage as keyof typeof t.ws.stages] ?? x.stage}</td>
              <td>{t.ws.outreach.enrollStatus[x.status as keyof typeof t.ws.outreach.enrollStatus] ?? x.status}</td>
              <td>{(x.status === "active" || x.status === "paused") && <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => run(() => removeEnrollment(x.enrollmentId))}>{t.ws.outreach.actions.remove}</button>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div></section>
  );
}

function Conversations({ detail, campaignId, when }: { detail: CampaignDetailData; campaignId: string; when: (iso: string) => string }) {
  const { t } = useI18n();
  const d = t.camp.detail;
  const kinds = t.sdr.kinds as Record<string, string>;
  return (
    <section className="sdr-panel"><div className="sdr-panel-body pad">
      <div className="cp-row"><span /><Link className="sdr-btn" href={`/inbox?campaign=${campaignId}`}>{d.openInbox}</Link></div>
      {!detail.conversations.length ? <p className="ws-hint">{d.convEmpty}</p> : (
        <ul className="cp-conv">{detail.conversations.map((c) => (
          <li key={c.leadId}><Link href={`/inbox?lead=${c.leadId}`}><strong dir="auto">{c.lead}</strong>{c.company && <span dir="auto"> · {c.company}</span>}</Link>
            <span className="cp-kind">{c.kind ? kinds[c.kind] ?? c.kind : ""}{c.group ? ` · ${c.group}` : ""}</span>
            <p dir="auto">{c.preview}</p><time>{when(c.at)}</time></li>
        ))}</ul>
      )}
    </div></section>
  );
}

function Meetings({ detail, when }: { detail: CampaignDetailData; when: (iso: string) => string }) {
  const { t } = useI18n();
  const d = t.camp.detail;
  return (
    <section className="sdr-panel"><div className="sdr-panel-body pad">
      {!detail.meetings.length ? <p className="ws-hint">{d.meetEmpty}</p> : (
        <div className="cd-table-wrap"><table className="cd-table">
          <thead><tr><th>{d.colLead}</th><th>{d.colDate}</th><th>{d.colStatus}</th><th>{t.camp.meet.qualifiedQ}</th></tr></thead>
          <tbody>{detail.meetings.map((m) => (
            <tr key={m.id}><td><Link href={`/inbox?lead=${m.leadId}`} dir="auto">{m.lead}</Link></td><td>{when(m.at)}</td><td>{t.meetings.status[m.status as keyof typeof t.meetings.status] ?? m.status}</td>
              <td>{m.qualified == null ? "–" : m.qualified ? d.qualified : d.notQualified}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="ws-hint"><Link className="ws-link" href="/meetings">{t.ws.nav.meetings}</Link></p>
    </div></section>
  );
}

function Performance({ detail, n }: { detail: CampaignDetailData; n: (v: number) => string }) {
  const { t, locale } = useI18n();
  const d = t.camp.detail;
  const [dim, setDim] = useState<Dimension>("day");
  const rows = detail.breakdowns[dim];
  const label = (k: string) => (dim === "country" && /^[A-Z]{2}$/.test(k) ? countryLabel(k, locale) : k);
  return (
    <section className="sdr-panel"><div className="sdr-panel-body pad">
      <div className="cp-row"><label className="cp-dim">{d.perfBy}
        <select className="sdr-input sm" value={dim} onChange={(e) => setDim(e.target.value as Dimension)}>{(Object.keys(d.dims) as Dimension[]).map((k) => <option key={k} value={k}>{d.dims[k]}</option>)}</select></label></div>
      {!rows.length ? <p className="ws-hint">{d.perfEmpty}</p> : (
        <div className="cd-table-wrap"><table className="cd-table">
          <thead><tr><th>{d.dims[dim]}</th><th>{d.colContacted}</th><th>{d.colSent}</th><th>{d.colBounced}</th><th>{d.colReplies}</th><th>{d.colInterested}</th><th>{d.colMeetings}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><td dir="auto">{label(r.key)}</td><td>{n(r.contacted)}</td><td>{n(r.sent)}</td><td>{n(r.bounced)}</td><td>{n(r.replies)}</td><td>{n(r.interested)}</td><td>{n(r.meetings)}</td></tr>)}</tbody>
        </table></div>
      )}
    </div></section>
  );
}

function Settings({ c, members, zones, rate }: { c: CampaignInfo; members: { id: string; name: string }[]; zones: { value: string; label: string }[]; rate: number }) {
  const { t, locale } = useI18n();
  const w = t.camp.wiz;
  const { run, pending } = useRun();
  const [s, setS] = useState(c);
  const set = (x: Partial<CampaignInfo>) => setS((cur) => ({ ...cur, ...x }));
  const n = (v: number) => formatNumber(v, locale);
  return (
    <section className="wz-card">
      <h3>{t.camp.detail.settingsTitle}</h3>
      <div className="ws-grid-2">
        <label className="ws-field"><span className="ws-label">{w.basics.name}</span><input className="form-input" dir="auto" maxLength={160} value={s.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="ws-field"><span className="ws-label">{w.basics.objective}</span><select className="form-input" value={s.objective} onChange={(e) => set({ objective: e.target.value as CampaignObjective })}>{OBJECTIVES.map((o) => <option key={o} value={o}>{t.camp.manager.objectives[o]}</option>)}</select></label>
      </div>
      {s.objective === "promote" && <label className="ws-field"><span className="ws-label">{w.basics.link}</span><input className="form-input" dir="ltr" value={s.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} /></label>}
      <label className="ws-field"><span className="ws-label">{w.basics.description}</span><textarea className="form-input" rows={2} dir="auto" value={s.description} onChange={(e) => set({ description: e.target.value })} /></label>
      {members.length > 1 && <label className="ws-field"><span className="ws-label">{w.basics.owner}</span><select className="form-input" value={s.ownerId ?? ""} onChange={(e) => set({ ownerId: e.target.value || null })}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
      <div className="ws-grid-2">
        <div className="ws-field"><span className="ws-label">{w.budget.type}</span><div className="wz-seg">{(["total", "daily", "monthly"] as const).map((b) => <button key={b} type="button" className={(s.budgetType ?? "total") === b ? "on" : ""} onClick={() => set({ budgetType: b })}>{w.budget.types[b]}</button>)}</div></div>
        <label className="ws-field"><span className="ws-label">{w.budget.amount}</span><input className="form-input" type="number" min={0} value={s.budgetUsd ?? 0} onChange={(e) => set({ budgetUsd: Math.max(0, Number(e.target.value) || 0) })} />
          <span className="ws-hint">{rate > 0 ? fmt(w.budget.rate, { n: n(Math.floor((s.budgetUsd ?? 0) / rate)), rate: `$${rate.toFixed(2)}` }) : ""}</span></label>
      </div>
      <div className="ws-grid-2">
        <div className="ws-field"><span className="ws-label">{w.budget.start}</span><div className="wz-pair"><input className="form-input" type="date" value={s.startDate} onChange={(e) => set({ startDate: e.target.value })} /><input className="form-input" type="time" value={s.startTime} onChange={(e) => set({ startTime: e.target.value })} /></div></div>
        <div className="ws-field"><span className="ws-label">{w.budget.end}</span><div className="wz-pair"><input className="form-input" type="date" value={s.endDate} onChange={(e) => set({ endDate: e.target.value })} /><input className="form-input" type="time" value={s.endTime} onChange={(e) => set({ endTime: e.target.value })} /></div></div>
      </div>
      <div className="ws-grid-2">
        <label className="ws-field"><span className="ws-label">{w.budget.timezone}</span><select className="form-input" value={s.timezone} onChange={(e) => set({ timezone: e.target.value })}>{zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}</select></label>
        <label className="ws-field"><span className="ws-label">{w.budget.daily}</span><input className="form-input" type="number" min={1} max={500} value={s.dailyLimit} onChange={(e) => set({ dailyLimit: Math.max(1, Number(e.target.value) || 1) })} /></label>
      </div>
      <div className="ws-field"><span className="ws-label">{w.budget.days}</span><div className="wz-days">{DAYS.map((dd) => <button key={dd} type="button" className={s.runDays.includes(dd) ? "on" : ""} onClick={() => set({ runDays: s.runDays.includes(dd) ? s.runDays.filter((x) => x !== dd) : [...s.runDays, dd] })}>{w.budget.dayNames[dd]}</button>)}</div></div>
      <div className="ws-grid-2">
        <div className="ws-field"><span className="ws-label">{w.budget.hours}</span><div className="wz-pair narrow"><input className="form-input" type="time" value={s.contactFrom} onChange={(e) => set({ contactFrom: e.target.value })} /><input className="form-input" type="time" value={s.contactTo} onChange={(e) => set({ contactTo: e.target.value })} /></div></div>
        <label className="ws-field"><span className="ws-label">{w.budget.target}</span><input className="form-input" type="number" min={0} max={1000} value={s.targetMeetings} onChange={(e) => set({ targetMeetings: Math.max(0, Number(e.target.value) || 0) })} /></label>
      </div>
      <div className="wiz-actions"><button type="button" className="sdr-btn primary" disabled={pending || !s.name.trim() || !s.runDays.length} onClick={() => run(() => updateCampaignSettings({
        id: s.id, name: s.name, objective: s.objective, description: s.description, ownerId: s.ownerId, ctaUrl: s.ctaUrl, budgetType: s.budgetType ?? "total", budgetUsd: s.budgetUsd ?? 0,
        startDate: s.startDate, startTime: s.startTime, endDate: s.endDate, endTime: s.endTime, timezone: s.timezone, runDays: s.runDays as never, contactFrom: s.contactFrom, contactTo: s.contactTo,
        dailyLimit: s.dailyLimit, targetMeetings: s.targetMeetings,
      }))}>{t.camp.detail.save}</button></div>
    </section>
  );
}

export { METRICS };
