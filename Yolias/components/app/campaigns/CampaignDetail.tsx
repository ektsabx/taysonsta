"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, BarChart3, Ban, ChevronLeft, Clock, Eye, Layers, ListOrdered, Loader2, Mail, MailCheck, MessageSquare, Pause, Play, Plus, Reply, Search, Table2, Trash2, UserPlus, Users, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { removeEnrollment, runOutreach, saveOutreachCampaign, writeNextEmails } from "@/app/(app)/outreach/actions";
import { openSettingsTab } from "@/components/app/open-settings";
import { AIMS, aimUsesLink } from "@/lib/outreach/aim";
import { languageLabels, messageLanguages, objectives, tones } from "@/lib/outreach/channels";
import { LaunchPanel, type MailboxOption } from "@/components/app/ws/LaunchPanel";
import { AddLeadsDialog, Composer } from "@/components/app/ws/CampaignWorkspace";
import { CampaignStatus } from "./CampaignList";
import { initials, RowMenu, useAgo } from "@/components/app/sdr/bits";
import type { CampaignLead, CampaignPage, LeadView } from "@/services/campaigns";
import type { CampaignWorkspace, LaunchSummary, OutreachDetail } from "@/services/outreach-campaigns";
import type { CampaignAim } from "@/types/acquisition";
import type { LeadStage, MessageObjective, MessageTone } from "@/types/database";

export type CampaignTab = "leads" | "sequence";

interface Props {
  page: CampaignPage;
  detail: OutreachDetail;
  work: CampaignWorkspace;
  launch: LaunchSummary;
  options: { profiles: { id: string; name: string; is_default: boolean }[]; offers: { id: string; name: string }[] };
  maxSteps: number;
  candidates: { id: string; name: string; company_name: string | null; stage: LeadStage; do_not_contact: boolean }[];
  mailboxes: MailboxOption[];
  mailboxName: string | null;
  dailyLimit: number;
  tab: CampaignTab;
  timeZone: string | null;
}

// A campaign's page (D-256, after AgentSDR): back link, name and status,
// Pause / Resume, today's strip, then Analytics, Leads and Sequence. A draft
// shows the approval panel (one approval, D-253) above the tabs, and Yolias
// writes each lead's first email while the page is open (D-239).
export function CampaignDetail(p: Props) {
  const { t, locale } = useI18n();
  const c = t.sdr.campaigns;
  const router = useRouter();
  const toast = useToast();
  const ago = useAgo();
  const [pending, start] = useTransition();
  const s = p.page.summary;
  const camp = p.page.campaign;
  const n = (v: number) => formatNumber(v, locale);
  const archived = camp.status === "archived";
  const hasMailbox = p.mailboxes.length > 0;
  const created = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { dateStyle: "medium", timeStyle: "short", ...(p.timeZone ? { timeZone: p.timeZone } : {}) }).format(new Date(s.createdAt));

  // Yolias writes the first emails while the page is open, two at a time (D-239).
  const toWrite = p.work.leads.filter((l) => l.status === "active" && l.step === 0 && !l.message).length;
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!hasMailbox || archived || !toWrite || started.current) return;
    started.current = true;
    let stop = false;
    (async () => {
      setWriting(true);
      for (let i = 0; i < 300 && !stop; i++) {
        const r = await writeNextEmails(camp.id).catch(() => null);
        if (stop) break;
        if (!r || !r.ok) { setWriteError(r && !r.ok ? r.error : t.ws.common.error); break; }
        router.refresh();
        if (r.remaining === 0) break;
      }
      setWriting(false);
      started.current = false;
    })();
    return () => { stop = true; };
  }, [hasMailbox, archived, toWrite, camp.id, router, t.ws.common.error]);

  const run = (action: "pause" | "resume") => start(async () => {
    const r = await runOutreach(camp.id, action);
    if (!r.ok) toast(r.error, "error");
    router.refresh();
  });
  const tabHref = (k: CampaignTab) => `/outreach/${camp.id}${k === "leads" ? "" : `?tab=${k}`}`;

  return (
    <div className="sdr-page">
      <div>
        <Link className="sdr-back" href="/outreach"><ChevronLeft className="flip-rtl" />{c.back}</Link>
        <div className="sdr-head">
          <div>
            <div className="sdr-title-row"><h2 dir="auto" style={{ margin: 0, fontSize: "1.55rem", fontWeight: 600 }}>{camp.name}</h2><CampaignStatus view={s.view} /></div>
            <div className="sdr-meta">{fmt(c.created, { date: created, steps: n(s.steps) })}</div>
          </div>
          <div className="sdr-head-actions">
            {s.approved && camp.status === "active" && <button type="button" className="sdr-btn" disabled={pending} onClick={() => run("pause")}><Pause />{c.pause}</button>}
            {s.approved && camp.status === "paused" && <button type="button" className="sdr-btn primary" disabled={pending} onClick={() => run("resume")}><Play />{c.resume}</button>}
          </div>
        </div>
      </div>

      <div className="sdr-strip">
        <div><span className="sdr-stat-icon"><Mail /></span><div><div className="sdr-strip-label">{c.stripFollowUps}</div><div className="sdr-strip-value">{n(p.page.today.followUps)}</div></div></div>
        <div><span className="sdr-stat-icon"><UserPlus /></span><div><div className="sdr-strip-label">{c.stripNewLeads}</div><div className="sdr-strip-value">{n(p.page.today.newLeads)}</div></div></div>
        <div><span className="sdr-stat-icon"><Layers /></span><div><div className="sdr-strip-label">{c.stripSteps}</div><div className="sdr-strip-value">{n(s.steps)}</div></div></div>
        <div><span className="sdr-stat-icon"><Clock /></span><div><div className="sdr-strip-label">{c.stripNext}</div><div className="sdr-strip-value">{s.nextSendAt && camp.status === "active" ? ago(s.nextSendAt) : c.nextNone}</div></div></div>
      </div>

      {!archived && !s.approved && (
        !hasMailbox ? (
          <section className="sdr-panel"><div className="sdr-panel-body pad" style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div><div className="sdr-panel-title">{t.ws.outreach.workspace.noMailboxTitle}</div><div className="sdr-panel-sub">{t.ws.outreach.workspace.noMailbox}</div></div>
            <button className="sdr-btn primary" type="button" onClick={() => openSettingsTab("integration")}>{t.ws.outreach.workspace.connect}</button>
          </div></section>
        ) : <LaunchPanel summary={p.launch} mailboxes={p.mailboxes} mailboxName={p.mailboxName} dailyLimit={p.dailyLimit} />
      )}
      {(writing || writeError || (hasMailbox && toWrite > 0 && !archived)) && (
        <div className={`ow-progress${writeError ? " error" : ""}`} role="status">
          {writeError ? <AlertCircle /> : <Loader2 className="spin" />}
          <span>{writeError ?? fmt(t.ws.outreach.workspace.writing, { done: p.work.leads.length - toWrite, total: p.work.leads.length })}</span>
        </div>
      )}

      {/* Analytics live in one place (owner, 2026-10-28): the campaign keeps its numbers, the charts are on the Analytics page. */}
      <CampaignNumbers page={p.page} />
      <Link className="sdr-btn" style={{ alignSelf: "flex-start" }} href={`/analytics?campaign=${camp.id}`}><BarChart3 />{c.fullAnalytics}</Link>

      <nav className="sdr-tabs">
        <Link href={tabHref("leads")} className={p.tab === "leads" ? "active" : ""}><Users />{c.tabs.leads}<span className="sdr-count">{n(s.leads)}</span></Link>
        <Link href={tabHref("sequence")} className={p.tab === "sequence" ? "active" : ""}><ListOrdered />{c.tabs.sequence}<span className="sdr-count">{n(s.steps)}</span></Link>
      </nav>

      {p.tab === "leads" && <Leads {...p} />}
      {p.tab === "sequence" && <Sequence {...p} />}
    </div>
  );
}

/* ── Analytics ── */

/** The campaign's six numbers (its page and the Analytics page). */
export function CampaignNumbers({ page }: { page: CampaignPage }) {
  const { t, locale } = useI18n();
  const a = t.sdr.campaigns.a;
  const s = page.summary;
  const n = (v: number) => formatNumber(v, locale);
  const pct = (x: number, of: number) => (of ? ((x / of) * 100).toFixed(of < 100 ? 1 : 2).replace(/\.0+$/, "") : "0");
  const cards: [typeof Mail, string, number, string, string?][] = [
    [Users, a.leads, s.leads, a.leadsNote],
    [Mail, a.contacted, s.contacted, fmt(a.contactedNote, { pct: pct(s.contacted, s.leads) })],
    [MailCheck, a.sent, s.sent, fmt(a.sentNote, { n: n(s.scheduled) })],
    [Reply, a.replied, s.replied, fmt(a.repliedNote, { pct: pct(s.replied, s.contacted) }), a.repliedHint],
    [Ban, a.bounced, s.bounced, fmt(a.bouncedNote, { pct: pct(s.bounced, s.contacted) })],
    [AlertCircle, a.failed, s.failed, s.failed ? a.failedNote : a.failedNone],
  ];
  return (
    <div className="sdr-stats" style={{ ["--cols" as string]: 6 }}>
      {cards.map(([Icon, label, value, note, hint]) => (
        <div key={label} className="sdr-stat"><div className="sdr-stat-icon"><Icon /></div><div className="sdr-stat-label" title={hint}>{label}</div><div className="sdr-stat-value">{n(value)}</div><div className="sdr-stat-note">{note}</div></div>
      ))}
    </div>
  );
}

/** One campaign's analytics on the Analytics page: its numbers, where its leads stand, its daily activity. */
export function CampaignAnalytics({ page }: { page: CampaignPage }) {
  return (
    <div className="sdr-page">
      <CampaignNumbers page={page} />
      <div className="sdr-two">
        <Stand page={page} />
        <Activity page={page} />
      </div>
    </div>
  );
}

function Stand({ page }: { page: CampaignPage }) {
  const { t, locale } = useI18n();
  const a = t.sdr.campaigns.a;
  const s = page.summary;
  const n = (v: number) => formatNumber(v, locale);
  const rows: [keyof CampaignPage["stand"], string][] = [["inProgress", "var(--red)"], ["yetToStart", "var(--line-strong)"], ["completed", "var(--green)"], ["replied", "var(--blue)"], ["bouncedOrUnsubscribed", "var(--danger)"]];
  const total = s.leads || 1;
  const done = s.sent, all = s.sent + s.scheduled;
  let acc = 0;
  const R = 56, C = 2 * Math.PI * R;
  return (
    <section className="sdr-panel">
      <div className="sdr-panel-head"><div><div className="sdr-panel-title">{a.standTitle}</div><div className="sdr-panel-sub">{a.standSub}</div></div></div>
      <div className="sdr-panel-body pad">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div><span style={{ fontSize: "1.5rem", fontWeight: 600 }}>{(all ? (done / all) * 100 : 0).toFixed(1)}%</span> <span className="sdr-panel-sub">{a.done}</span></div>
          <span className="sdr-panel-sub">{fmt(a.doneOf, { done: n(done), total: n(all) })}</span>
        </div>
        <div className="sdr-bar" style={{ height: 8, margin: "10px 0 20px" }}><span style={{ width: `${all ? (done / all) * 100 : 0}%` }} /></div>
        <div className="sdr-stand">
          <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label={a.standTitle}>
            <circle cx="70" cy="70" r={R} fill="none" stroke="var(--track)" strokeWidth="14" />
            {rows.map(([k, color]) => {
              const v = page.stand[k] / total;
              const el = v > 0 ? <circle key={k} cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="14" strokeDasharray={`${v * C} ${C}`} strokeDashoffset={-acc * C} transform="rotate(-90 70 70)" /> : null;
              acc += v;
              return el;
            })}
            <text x="70" y="68" textAnchor="middle" style={{ fontSize: 22, fontWeight: 600, fill: "var(--ink)" }}>{n(s.leads)}</text>
            <text x="70" y="88" textAnchor="middle" style={{ fontSize: 11, fill: "var(--muted)" }}>{a.leadsLabel}</text>
          </svg>
          <ul className="sdr-legend">
            {rows.map(([k, color]) => (
              <li key={k}><span className="dot" style={{ background: color }} /><span>{a.stand[k]}</span><strong>{n(page.stand[k])}</strong><span className="muted">{((page.stand[k] / total) * 100).toFixed(1)}%</span></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Activity({ page }: { page: CampaignPage }) {
  const { t, locale } = useI18n();
  const a = t.sdr.campaigns.a;
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [asTable, setAsTable] = useState(false);
  const days = page.activity.slice(-range);
  const n = (v: number) => formatNumber(v, locale);
  const totals = days.reduce((x, d) => ({ sent: x.sent + d.sent, scheduled: x.scheduled + d.scheduled, failed: x.failed + d.failed }), { sent: 0, scheduled: 0, failed: 0 });
  const max = Math.max(4, ...days.map((d) => d.sent + d.failed + d.scheduled));
  const top = Math.ceil(max / 4) * 4;
  const label = (day: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const W = 560, H = 220, L = 30, B = 24, bw = (W - L) / days.length;
  return (
    <section className="sdr-panel">
      <div className="sdr-panel-head">
        <div><div className="sdr-panel-title">{a.activityTitle}</div><div className="sdr-panel-sub">{a.activitySub}</div></div>
        <div className="sdr-panel-tools">
          <div className="sdr-seg">{([7, 14, 30] as const).map((r) => <button key={r} type="button" className={range === r ? "active" : ""} onClick={() => setRange(r)}>{a.range[`d${r}`]}</button>)}</div>
          <button type="button" className="sdr-icon-btn bordered" aria-label={asTable ? a.chart : a.table} title={asTable ? a.chart : a.table} onClick={() => setAsTable((x) => !x)}>{asTable ? <BarChart3 /> : <Table2 />}</button>
        </div>
      </div>
      <div className="sdr-panel-body pad">
        <div className="sdr-keys">
          <div><span className="dot" style={{ background: "var(--red)" }} />{a.sentKey}<strong>{n(totals.sent)}</strong></div>
          <div><span className="dot" style={{ background: "var(--line-strong)" }} />{a.scheduledKey}<strong>{n(totals.scheduled)}</strong></div>
          <div><span className="dot" style={{ background: "var(--danger)" }} />{a.failedKey}<strong>{n(totals.failed)}</strong></div>
        </div>
        {asTable ? (
          <div className="sdr-table-wrap" style={{ maxHeight: 260, overflow: "auto" }}>
            <table className="sdr-table"><thead><tr><th>{a.day}</th><th className="num">{a.sentKey}</th><th className="num">{a.scheduledKey}</th><th className="num">{a.failedKey}</th></tr></thead>
              <tbody>{[...days].reverse().map((d) => <tr key={d.day}><td>{label(d.day)}</td><td className="num">{n(d.sent)}</td><td className="num">{n(d.scheduled)}</td><td className="num">{n(d.failed)}</td></tr>)}</tbody></table>
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={a.activityTitle} style={{ direction: "ltr" }}>
            {[0, 1, 2, 3, 4].map((i) => { const y = (H - B) - (i / 4) * (H - B - 10); return <g key={i}><line x1={L} x2={W} y1={y} y2={y} stroke="var(--line-faint)" /><text x={L - 6} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: "var(--muted)" }}>{(top / 4) * i}</text></g>; })}
            {days.map((d, i) => {
              const h = (v: number) => (v / top) * (H - B - 10);
              const x = L + i * bw + bw * 0.2, w = bw * 0.6;
              let y = H - B;
              const seg = (v: number, color: string) => { if (!v) return null; y -= h(v); return <rect x={x} y={y} width={w} height={h(v)} rx="2" fill={color}><title>{`${label(d.day)}: ${v}`}</title></rect>; };
              return <g key={d.day}>{seg(d.sent, "var(--red)")}{seg(d.scheduled, "var(--line-strong)")}{seg(d.failed, "var(--danger)")}{(i % Math.ceil(days.length / 7) === 0) && <text x={x + w / 2} y={H - 6} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)" }}>{label(d.day)}</text>}</g>;
            })}
          </svg>
        )}
      </div>
    </section>
  );
}

/* ── Leads ── */

const LEAD_TONE: Record<LeadView, string> = { pending: "gray", in_sequence: "blue", replied: "green", completed: "gray", bounced: "red", suppressed: "red" };

function Leads(p: Props) {
  const { t, locale } = useI18n();
  const l = t.sdr.campaigns.l;
  const router = useRouter();
  const [view, setView] = useState<"all" | LeadView>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<CampaignLead | null>(null);
  const [pending, start] = useTransition();
  const n = (v: number) => formatNumber(v, locale);
  const leads = p.page.leads;
  const steps = Math.max(p.page.summary.steps, 1);
  const count = (v: LeadView) => leads.filter((x) => x.view === v).length;
  const shown = leads.filter((x) => view === "all" || x.view === view).filter((x) => !q || `${x.name} ${x.email ?? ""} ${x.company ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(p.timeZone ? { timeZone: p.timeZone } : {}) }).format(new Date(iso));
  const archived = p.page.campaign.status === "archived";
  const work = open ? p.work.leads.find((x) => x.enrollmentId === open.enrollmentId) ?? null : null;
  return (
    <section className="sdr-panel">
      <div className="sdr-panel-head">
        <div><div className="sdr-panel-title">{l.title}</div><div className="sdr-panel-sub">{l.sub}</div></div>
        {!archived && <div className="sdr-panel-tools"><button type="button" className="sdr-btn" onClick={() => setAdding(true)}><Plus />{l.add}</button><Link className="sdr-btn primary" href="/prospects">{l.importCsv}</Link></div>}
      </div>
      <div className="sdr-panel-body">
        <div style={{ padding: "12px 12px 4px", display: "grid", gap: 10 }}>
          <div className="sdr-seg" style={{ overflowX: "auto", maxWidth: "100%" }}>
            {(["all", "pending", "in_sequence", "replied", "completed", "bounced", "suppressed"] as const).map((v) => (
              <button key={v} type="button" className={view === v ? "active" : ""} onClick={() => setView(v)}>{l.views[v]} <span className="n">{n(v === "all" ? leads.length : count(v))}</span></button>
            ))}
          </div>
          <label className="sdr-search" style={{ maxWidth: 300 }}><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={l.search} aria-label={l.search} /></label>
        </div>
        <div className="sdr-table-wrap sdr-table-inset">
          <table className="sdr-table">
            <thead><tr><th>{l.colLead}</th><th>{l.colLast}</th><th>{l.colProgress}</th><th>{l.colNext}</th><th>{l.colStatus}</th><th aria-label={t.sdr.common.more} /></tr></thead>
            <tbody>
              {!shown.length && <tr><td colSpan={6} className="empty">{leads.length ? l.noMatch : l.empty}</td></tr>}
              {shown.map((x) => (
                <tr key={x.enrollmentId} className="clickable" onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button")) setOpen(x); }}>
                  <td style={{ maxWidth: 260 }}><div className="sdr-who"><span className="sdr-avatar">{initials(x.name)}</span><div><span className="sdr-cell-main" dir="auto">{x.name}</span><span className="sdr-cell-sub" dir="ltr">{x.email ?? x.company ?? "-"}</span></div></div></td>
                  <td style={{ maxWidth: 280 }}><span className="sdr-clamp" dir="auto">{x.lastMessage ?? "-"}</span></td>
                  <td style={{ minWidth: 150 }}><div className="sdr-bar-row"><span className="sdr-bar"><span style={{ width: `${Math.min(100, (x.step / steps) * 100)}%` }} /></span><span className="muted" style={{ fontSize: ".78rem" }}>{x.step}/{steps}</span></div></td>
                  <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>{x.nextSendAt ? when(x.nextSendAt) : "-"}</td>
                  <td><span className={`sdr-badge ${LEAD_TONE[x.view]}`}>{l.views[x.view]}</span></td>
                  <td className="num">
                    <RowMenu label={t.sdr.common.more}>{(close) => (<>
                      <button type="button" onClick={() => { close(); setOpen(x); }}><Eye />{t.sdr.common.open}</button>
                      <Link href={`/inbox?lead=${x.leadId}`} onClick={close}><MessageSquare />{l.conversation}</Link>
                      {!archived && x.view !== "completed" && (<><hr /><button type="button" className="danger" disabled={pending} onClick={() => { close(); if (window.confirm(fmt(l.removeConfirm, { name: x.name }))) start(async () => { await removeEnrollment(x.enrollmentId); router.refresh(); }); }}><Trash2 />{l.remove}</button></>)}
                    </>)}</RowMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <div className="sdr-drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <aside className="sdr-drawer" role="dialog" aria-modal="true" aria-label={open.name}>
            <div className="sdr-drawer-head">
              <span className={`sdr-badge ${LEAD_TONE[open.view]}`}>{l.views[open.view]}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Link className="sdr-btn sm" href={`/inbox?lead=${open.leadId}`}><MessageSquare />{l.conversation}</Link>
                <button type="button" className="sdr-icon-btn" aria-label={t.common.close} onClick={() => setOpen(null)}><X /></button>
              </div>
            </div>
            <div className="sdr-drawer-body">
              {work ? <Composer key={`${work.enrollmentId}:${work.message?.id ?? ""}:${work.message?.status ?? ""}`} lead={work} hasMailbox={p.mailboxes.length > 0} writing={!archived && work.status === "active"} timeZone={p.timeZone} /> : <p className="sdr-panel-sub">-</p>}
            </div>
          </aside>
        </div>
      )}
      {adding && <AddLeadsDialog campaignId={p.page.campaign.id} candidates={p.candidates.filter((c) => !leads.some((x) => x.leadId === c.id))} onClose={() => { setAdding(false); router.refresh(); }} />}
    </section>
  );
}

/* ── Sequence ── */

type Step = { delay_days: number; objective: MessageObjective; instruction: string };

function Sequence(p: Props) {
  const { t } = useI18n();
  const sq = t.sdr.campaigns.s;
  const o = t.ws.outreach;
  const toast = useToast();
  const router = useRouter();
  const c = p.detail.campaign;
  const archived = c.status === "archived";
  const initial = useMemo(() => ({
    steps: (p.detail.steps.length ? p.detail.steps : [{ delay_days: 0, objective: "introduction", instruction: "" }]).map((s) => ({ delay_days: s.delay_days, objective: s.objective as MessageObjective, instruction: s.instruction ?? "" })) as Step[],
    language: c.language, tone: c.tone as MessageTone, aim: ((c.aim as CampaignAim | undefined) ?? "meeting"), cta: c.cta_url ?? "", profile: c.customer_profile_id, offer: c.offer_id,
  }), [p.detail.steps, c]);
  const [v, setV] = useState(initial);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const step = v.steps[sel] ?? v.steps[0]!;
  const setStep = (patch: Partial<Step>) => setV({ ...v, steps: v.steps.map((s, i) => (i === sel ? { ...s, ...patch } : s)) });
  const save = () => start(async () => {
    const r = await saveOutreachCampaign({
      id: c.id, name: c.name, goal: c.goal ?? "", description: c.description ?? "", channel: "email", language: v.language, tone: v.tone,
      customer_profile_id: v.profile, offer_id: v.offer, steps: v.steps, aim: v.aim, cta_url: aimUsesLink(v.aim) ? v.cta.trim() || null : null,
    });
    if (r.ok) { toast(sq.saved); router.refresh(); } else toast(r.error, "error");
  });
  return (
    <div className="sdr-seq">
      <section className="sdr-panel">
        <div className="sdr-panel-head"><div><div className="sdr-panel-title">{sq.flow}</div><div className="sdr-panel-sub">{fmt(sq.flowSub, { n: v.steps.length })}</div></div></div>
        <div className="sdr-panel-body" style={{ padding: 10 }}>
          <ol className="sdr-flow">
            {v.steps.map((s, i) => (
              <li key={i}>
                {i > 0 && (
                  <div className="sdr-wait"><Clock />{sq.wait}<input className="sdr-input num" type="number" min={1} max={90} disabled={archived} value={s.delay_days} onChange={(e) => setV({ ...v, steps: v.steps.map((x, j) => (j === i ? { ...x, delay_days: Math.max(1, Math.min(90, Number(e.target.value) || 1)) } : x)) })} />{sq.days}</div>
                )}
                <button type="button" className={`sdr-flow-step${sel === i ? " active" : ""}`} onClick={() => setSel(i)}>
                  <span className="num">{i + 1}</span>
                  <span><strong>{fmt(sq.step, { n: i + 1 })}</strong><span className="sdr-cell-sub sdr-ellipsis" style={{ display: "block", maxWidth: 170 }}>{i === 0 ? (s.instruction || o.objectives[s.objective]) : sq.sameThread}</span></span>
                </button>
              </li>
            ))}
          </ol>
          {!archived && <button type="button" className="sdr-btn" style={{ width: "100%" }} disabled={v.steps.length >= p.maxSteps} onClick={() => { setV({ ...v, steps: [...v.steps, { delay_days: 3, objective: "follow_up", instruction: "" }] }); setSel(v.steps.length); }}><Plus />{sq.add}</button>}
          <p className="sdr-panel-sub" style={{ marginTop: 8 }}>{fmt(sq.max, { n: p.maxSteps })}</p>
        </div>
      </section>

      <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
        <section className="sdr-panel">
          <div className="sdr-panel-head">
            <div><div className="sdr-panel-title">{sel === 0 ? sq.initial : fmt(sq.followUp, { n: sel })}</div><div className="sdr-panel-sub">{sel === 0 ? sq.initialSub : fmt(sq.followUpSub, { days: step.delay_days })}</div></div>
            <div className="sdr-panel-tools">
              {sel > 0 && !archived && <button type="button" className="sdr-btn ghost" onClick={() => { setV({ ...v, steps: v.steps.filter((_, i) => i !== sel) }); setSel(Math.max(0, sel - 1)); }}><Trash2 />{sq.remove}</button>}
              <button type="button" className="sdr-btn" onClick={() => setPreview(true)}><Eye />{sq.preview}</button>
            </div>
          </div>
          <div className="sdr-panel-body pad" style={{ display: "grid", gap: 14 }}>
            <label><span className="sdr-field-label">{sq.purpose}</span>
              <select className="sdr-input" style={{ width: "100%" }} disabled={archived} value={step.objective} onChange={(e) => setStep({ objective: e.target.value as MessageObjective })}>
                {objectives.map((x) => <option key={x} value={x}>{o.objectives[x]}</option>)}
              </select></label>
            <label><span className="sdr-field-label">{sq.goal}</span>
              <textarea className="sdr-input" style={{ width: "100%", minHeight: 150, padding: 12, lineHeight: 1.6 }} dir="auto" disabled={archived} maxLength={1000} placeholder={sq.goalPh} value={step.instruction} onChange={(e) => setStep({ instruction: e.target.value })} />
              <span className="sdr-cell-sub" style={{ marginTop: 6 }}>{sq.goalSub}</span></label>
          </div>
        </section>

        <section className="sdr-panel">
          <div className="sdr-panel-head"><div className="sdr-panel-title">{sq.settings}</div></div>
          <div className="sdr-panel-body pad sdr-grid3">
            <label><span className="sdr-field-label">{sq.aim}</span>
              <select className="sdr-input" disabled={archived} value={v.aim} onChange={(e) => setV({ ...v, aim: e.target.value as CampaignAim })}>{AIMS.map((x) => <option key={x} value={x}>{o.launch.aims[x]}</option>)}</select></label>
            {aimUsesLink(v.aim) && <label><span className="sdr-field-label">{o.launch.ctaUrl[v.aim]}</span><input className="sdr-input" dir="ltr" type="url" placeholder={o.launch.ctaPh} disabled={archived} value={v.cta} maxLength={500} onChange={(e) => setV({ ...v, cta: e.target.value })} /></label>}
            <label><span className="sdr-field-label">{sq.language}</span>
              <select className="sdr-input" disabled={archived} value={v.language} onChange={(e) => setV({ ...v, language: e.target.value })}>{(Object.keys(messageLanguages) as (keyof typeof messageLanguages)[]).map((x) => <option key={x} value={x}>{languageLabels[x]}</option>)}</select></label>
            <label><span className="sdr-field-label">{sq.tone}</span>
              <select className="sdr-input" disabled={archived} value={v.tone} onChange={(e) => setV({ ...v, tone: e.target.value as MessageTone })}>{tones.map((x) => <option key={x} value={x}>{o.tones[x]}</option>)}</select></label>
            <label><span className="sdr-field-label">{sq.profile}</span>
              <select className="sdr-input" disabled={archived} value={v.profile ?? ""} onChange={(e) => setV({ ...v, profile: e.target.value || null })}><option value="">{sq.none}</option>{p.options.profiles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label><span className="sdr-field-label">{sq.offer}</span>
              <select className="sdr-input" disabled={archived} value={v.offer ?? ""} onChange={(e) => setV({ ...v, offer: e.target.value || null })}><option value="">{sq.none}</option>{p.options.offers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          </div>
        </section>
        {archived ? <p className="sdr-panel-sub">{sq.archived}</p> : (
          <div className="sdr-foot" style={{ marginTop: 0 }}><button type="button" className="sdr-btn primary" disabled={!dirty || pending} onClick={save}>{sq.save}</button></div>
        )}
      </div>

      {preview && (
        <div className="sdr-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreview(false)}>
          <div className="sdr-dialog" role="dialog" aria-modal="true" style={{ width: "min(640px, 100%)" }}>
            <div className="sdr-dialog-head"><h4>{sq.previewTitle}</h4></div>
            <div className="sdr-dialog-body">
              {p.launch.sample ? (<>
                <div className="sdr-cell-sub" dir="ltr">{p.launch.sample.to_email}</div>
                <strong dir="auto">{p.launch.sample.subject}</strong>
                <div dir="auto" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: ".9rem" }}>{p.launch.sample.body}</div>
              </>) : <p className="sdr-panel-sub">{sq.previewNone}</p>}
            </div>
            <div className="sdr-dialog-foot"><button type="button" className="sdr-btn" onClick={() => setPreview(false)}>{t.common.close}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
