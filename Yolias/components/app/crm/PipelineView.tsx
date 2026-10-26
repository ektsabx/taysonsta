"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Hourglass, LayoutGrid, List, Mail, MessageSquare, Pencil, Send, UserRound, Users, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { sendNow } from "@/app/(app)/inbox/actions";
import { CompanyLogo } from "@/components/app/Media";
import { KindBadge, RowMenu, initials, useAgo } from "@/components/app/sdr/bits";
import type { Bucket, LeadStatus } from "@/services/pipeline";

const BUCKETS: Bucket[] = ["needs_action", "waiting", "exhausted"];
const ICON = { needs_action: Zap, waiting: Hourglass, exhausted: Archive } as const;

// The CRM (D-256, after AgentSDR's Pipeline): every lead with a conversation,
// by where it stands. Board (three columns) or List; "Potential" leaves out
// the leads who said no. A ready reply is sent from the card.
export function PipelineView({ leads, view, potential, total, hasMailbox }: { leads: LeadStatus[]; view: "board" | "list"; potential: boolean; total: Record<"open" | Bucket, number>; hasMailbox: boolean }) {
  const { t, locale } = useI18n();
  const x = t.sdr.pipeline;
  const router = useRouter();
  const [seg, setSeg] = useState<"all" | Bucket>("all");
  const n = (v: number) => formatNumber(v, locale);
  const href = (patch: Record<string, string | null>) => {
    const s = new URLSearchParams();
    const cur: Record<string, string | null> = { view: view === "list" ? "list" : null, show: potential ? null : "all", ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) s.set(k, v);
    return `/crm${s.size ? `?${s}` : ""}`;
  };
  const by = (b: Bucket) => leads.filter((l) => l.bucket === b);

  return (
    <div className="sdr-page">
      <header className="sdr-head"><div><h2>{x.title}</h2><p>{x.subtitle}</p></div></header>
      <div className="sdr-stats">
        <div className="sdr-stat"><div className="sdr-stat-icon"><Users /></div><div className="sdr-stat-label" title={x.openHint}>{x.open}</div><div className="sdr-stat-value">{n(total.open)}</div><div className="sdr-stat-note">{x.openNote}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><Zap /></div><div className="sdr-stat-label" title={x.needsHint}>{x.needs}</div><div className="sdr-stat-value">{n(total.needs_action)}</div><div className="sdr-stat-note">{x.needsNote}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><Hourglass /></div><div className="sdr-stat-label">{x.waiting}</div><div className="sdr-stat-value">{n(total.waiting)}</div><div className="sdr-stat-note">{x.waitingNote}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><Archive /></div><div className="sdr-stat-label" title={x.exhaustedHint}>{x.exhausted}</div><div className="sdr-stat-value">{n(total.exhausted)}</div><div className="sdr-stat-note">{x.exhaustedNote}</div></div>
      </div>
      <div className="sdr-pipe-bar">
        <div className="sdr-seg">
          <Link href={href({ view: null })} className={view === "board" ? "active" : ""}><LayoutGrid />{x.board}</Link>
          <Link href={href({ view: "list" })} className={view === "list" ? "active" : ""}><List />{x.list}</Link>
        </div>
        <select className="sdr-input" value={potential ? "potential" : "all"} onChange={(e) => router.push(href({ show: e.target.value === "all" ? "all" : null }))} aria-label={x.potential}>
          <option value="potential">{x.potential}</option>
          <option value="all">{x.everyone}</option>
        </select>
      </div>

      {!leads.length ? <div className="sdr-panel"><div className="sdr-panel-body pad"><p className="sdr-panel-sub">{x.empty}</p></div></div> : view === "board" ? (
        <div className="sdr-board">
          {BUCKETS.map((b) => {
            const Icon = ICON[b];
            const rows = by(b);
            return (
              <section key={b} className="sdr-column">
                <div className="sdr-column-head">
                  <span className={`sdr-column-icon ${b}`}><Icon /></span>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="sdr-panel-title" style={{ fontSize: "1rem" }}>{t.sdr.buckets[b]}</div><div className="sdr-panel-sub">{x.colSub[b]}</div></div>
                  <span className="sdr-column-count">{n(rows.length)}</span>
                </div>
                <div className="sdr-column-body">
                  {!rows.length && <p className="sdr-panel-sub" style={{ padding: 12 }}>{x.emptyColumn}</p>}
                  {rows.map((l) => <LeadCard key={l.leadId} lead={l} hasMailbox={hasMailbox} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="sdr-panel">
          <div className="sdr-panel-head">
            <div><div className="sdr-panel-title">{x.listTitle}</div><div className="sdr-panel-sub">{fmt(x.listSub, { n: n(leads.length) })}</div></div>
            <div className="sdr-seg">
              {(["all", ...BUCKETS] as const).map((k) => {
                const Icon = k === "all" ? null : ICON[k];
                return <button key={k} type="button" className={seg === k ? "active" : ""} onClick={() => setSeg(k)}>{Icon && <Icon />}{k === "all" ? x.all : k === "needs_action" ? x.needsShort : k === "waiting" ? x.waitingShort : x.exhaustedShort} <span className="n">{n(k === "all" ? leads.length : by(k).length)}</span></button>;
              })}
            </div>
          </div>
          <div className="sdr-panel-body">
            <div className="sdr-table-wrap sdr-table-inset">
              <table className="sdr-table">
                <thead><tr><th>{x.colContact}</th><th>{x.colClass}</th><th>{x.colLatest}</th><th>{x.colDraft}</th><th>{x.colStatus}</th><th aria-label={t.sdr.common.more} /></tr></thead>
                <tbody>
                  {leads.filter((l) => seg === "all" || l.bucket === seg).map((l) => <LeadRow key={l.leadId} lead={l} hasMailbox={hasMailbox} />)}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function useSend() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const send = (id: string) => start(async () => {
    const r = await sendNow(id);
    if (!r.ok) toast(r.error, "error"); else toast(t.sdr.pipeline.sent);
    router.refresh();
  });
  return { send, pending };
}

function Menu({ lead }: { lead: LeadStatus }) {
  const { t } = useI18n();
  const x = t.sdr.pipeline;
  return (
    <RowMenu label={t.sdr.common.more}>{(close) => (<>
      <Link href={`/inbox?lead=${lead.leadId}`} onClick={close}><MessageSquare />{x.menu.conversation}</Link>
      <Link href={`/crm/${lead.leadId}`} onClick={close}><UserRound />{x.menu.record}</Link>
    </>)}</RowMenu>
  );
}

function Who({ lead }: { lead: LeadStatus }) {
  return (
    <div className="sdr-who">
      <span className="sdr-avatar plain">{initials(lead.name)}<span className="sdr-avatar-chan"><Mail /></span></span>
      <div>
        <Link className="sdr-cell-main" href={`/inbox?lead=${lead.leadId}`} dir="auto">{lead.name}</Link>
        {(lead.domain || lead.companyName) && <span className="sdr-cell-sub sdr-co">{lead.domain && <CompanyLogo name={lead.companyName ?? lead.domain} logoUrl={lead.logoUrl} domain={lead.domain} size={14} />}<span dir="ltr">{lead.domain ?? lead.companyName}</span></span>}
      </div>
    </div>
  );
}

function LeadCard({ lead, hasMailbox }: { lead: LeadStatus; hasMailbox: boolean }) {
  const { t } = useI18n();
  const x = t.sdr.pipeline;
  const ago = useAgo();
  const { send, pending } = useSend();
  return (
    <article className="sdr-card">
      <div className="sdr-card-top"><Who lead={lead} /><Menu lead={lead} /></div>
      {lead.lastInbound && <KindBadge kind={lead.lastInbound.kind} />}
      {lead.lastInbound ? (
        <div className="sdr-card-reply"><div dir="auto">{lead.lastInbound.body.replace(/\s+/g, " ").slice(0, 120)}</div><span className="sdr-cell-sub"><Mail size={11} /> {ago(lead.lastInbound.at)}</span></div>
      ) : <span className="sdr-cell-sub">{x.noReply}</span>}
      {lead.bucket === "needs_action" && (lead.draft || lead.lastInbound?.suggestedReply) && (
        <div className="sdr-card-draft">
          <div dir="auto">{(lead.draft?.body ?? lead.lastInbound?.suggestedReply ?? "").replace(/\s+/g, " ").slice(0, 120)}</div>
          <div className="sdr-card-draft-foot">
            {lead.draft ? <span className="sdr-ready">{x.ready}</span> : <span className="sdr-cell-sub">{x.suggestion}</span>}
            <span style={{ display: "flex", gap: 6 }}>
              <Link className="sdr-btn sm" href={`/inbox?lead=${lead.leadId}`}><Pencil />{x.edit}</Link>
              {lead.draft && <button type="button" className="sdr-btn primary sm" disabled={pending || !hasMailbox} onClick={() => send(lead.draft!.id)}><Send />{x.send}</button>}
            </span>
          </div>
        </div>
      )}
      <StatusFoot lead={lead} />
    </article>
  );
}

function StatusFoot({ lead }: { lead: LeadStatus }) {
  const { t } = useI18n();
  const x = t.sdr.pipeline;
  const ago = useAgo();
  if (lead.bucket === "needs_action") return <div className="sdr-card-foot"><span className="sdr-badge red nodot"><Zap size={11} />{x.immediate}</span><span className="sdr-cell-sub">{x.answer}</span></div>;
  if (lead.followUp) return <div className="sdr-card-foot"><span className="sdr-badge violet nodot"><Hourglass size={11} />{x.followUp}</span><span className="sdr-cell-sub">{fmt(x.nextIn, { when: ago(lead.followUp.at) ?? "" })}</span></div>;
  if (lead.bucket === "waiting") return <div className="sdr-card-foot"><span className="sdr-badge violet nodot"><Hourglass size={11} />{x.waitingLabel}</span><span className="sdr-cell-sub">{fmt(x.sentAgo, { when: ago(lead.lastOutbound?.at) ?? "" })}</span></div>;
  return <div className="sdr-card-foot"><span className="sdr-badge gray nodot"><Archive size={11} />{x.allSent}</span><span className="sdr-cell-sub">{fmt(x.sentAgo, { when: ago(lead.lastOutbound?.at) ?? "" })}</span></div>;
}

function LeadRow({ lead, hasMailbox }: { lead: LeadStatus; hasMailbox: boolean }) {
  const { t } = useI18n();
  const x = t.sdr.pipeline;
  const ago = useAgo();
  const { send, pending } = useSend();
  const draft = lead.draft?.body ?? (lead.bucket === "needs_action" ? lead.lastInbound?.suggestedReply : null);
  return (
    <tr>
      <td style={{ maxWidth: 240 }}><Who lead={lead} /></td>
      <td>{lead.lastInbound ? <KindBadge kind={lead.lastInbound.kind} /> : <span className="sdr-cell-sub">-</span>}</td>
      <td style={{ maxWidth: 220 }}>{lead.lastInbound ? <div className="sdr-quote"><span className="sdr-ellipsis" dir="auto" style={{ display: "block" }}>{lead.lastInbound.body.replace(/\s+/g, " ")}</span><span className="sdr-cell-sub"><Mail size={11} /> {ago(lead.lastInbound.at)}</span></div> : "-"}</td>
      <td style={{ maxWidth: 260 }}>
        {draft ? (
          <div><span className="sdr-ellipsis" dir="auto" style={{ display: "block" }}>{draft.replace(/\s+/g, " ")}</span>{lead.draft ? <span className="sdr-ready">{x.ready} {hasMailbox && <button type="button" className="sdr-link" disabled={pending} onClick={() => send(lead.draft!.id)}>· {x.send}</button>}</span> : <span className="sdr-cell-sub">{x.suggestion}</span>}</div>
        ) : lead.followUp ? <div><span className="sdr-cell-main" style={{ fontWeight: 400 }}><Hourglass size={12} /> {x.followUp}</span><span className="sdr-cell-sub">{lead.followUp.campaign}</span></div>
          : <div><span className="sdr-cell-main" style={{ fontWeight: 400 }}><Archive size={12} /> {x.allSent}</span>{lead.campaigns[0] && <span className="sdr-cell-sub">{lead.campaigns[0].name}</span>}</div>}
      </td>
      <td style={{ textAlign: "end", whiteSpace: "nowrap" }}>
        {lead.bucket === "needs_action" ? <span className="sdr-badge red nodot"><Zap size={11} />{x.immediate}</span>
          : lead.bucket === "waiting" ? <div><span className="sdr-badge violet nodot"><Hourglass size={11} />{x.waitingLabel}</span><span className="sdr-cell-sub">{lead.followUp ? fmt(x.nextIn, { when: ago(lead.followUp.at) ?? "" }) : fmt(x.sentAgo, { when: ago(lead.lastOutbound?.at) ?? "" })}</span></div>
          : <div><span className="sdr-badge gray nodot"><Archive size={11} />{x.exhaustedLabel}</span><span className="sdr-cell-sub">{fmt(x.sentAgo, { when: ago(lead.lastOutbound?.at) ?? "" })}</span></div>}
      </td>
      <td className="num"><Menu lead={lead} /></td>
    </tr>
  );
}
