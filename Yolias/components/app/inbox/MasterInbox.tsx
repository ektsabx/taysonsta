"use client";

import { INBOX_SHOWS, type InboxShow } from "@/lib/inbox-shows";
import { LiveRefresh } from "@/components/app/LiveRefresh";
import { setOutcome } from "@/app/(app)/meetings/actions";
import { LOST_REASONS } from "@/components/app/ws/bits";
import { EmptyNext } from "@/components/app/EmptyNext";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, ChevronDown, ChevronLeft, ExternalLink, Loader2, Mail, MailOpen, PanelRight, PenLine, Reply, RotateCcw, Search, Send, UserRound, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { draftReplyAction, setTaskDone, markHandled, markThreadRead, sendReply, setReplyKind, setThreadStatus } from "@/app/(app)/inbox/actions";
import { LinkedInIcon } from "@/components/app/ConnectorIcons";
import { MessageCard, type CardMessage } from "@/components/app/ws/MessageCard";
import { KindBadge, initials, useAgo } from "@/components/app/sdr/bits";
import { REPLY_KINDS } from "@/lib/automations/schema";
import type { InboxListItem, InboxTab } from "@/services/master-inbox";
import type { InboxThread } from "@/services/inbox";
import type { LeadStatus } from "@/services/pipeline";

interface Props {
  tab: InboxTab;
  counts: Record<InboxTab, number>;
  items: InboxListItem[];
  q: string;
  thread: InboxThread | null;
  status: LeadStatus | null;
  hasMailbox: boolean;
  mailboxEmail: string | null;
  timeZone: string | null;
  /** The campaign being watched (?campaign=), with its live counts. */
  campaign: { id: string; name: string; active: boolean; leads: number; writing: number; sent: number; failed: number } | null;
  /** D-270: filter by campaign and by what the conversation shows. */
  campaigns: { id: string; name: string }[];
  show: InboxShow | null;
}

// D-274: "All" first (every conversation Yolias is having), then those that need the member.
const MAIN: InboxTab[] = ["all", "needs_you", "replies"];
const MORE: InboxTab[] = ["inbox", "to_approve", "out_of_office", "sent", "done"];

// Conversations (D-256, after AgentSDR's Master Inbox): the list with search,
// a campaign filter and tabs; the thread in the middle with the AI draft and
// the reply box; the lead's details on the side. J / K move, Enter opens,
// Esc goes back to the list.
export function MasterInbox(p: Props) {
  const { t, locale } = useI18n();
  const x = t.sdr.inbox;
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [cursor, setCursor] = useState(() => Math.max(0, p.items.findIndex((i) => i.leadId === p.thread?.lead.id)));
  const n = (v: number) => formatNumber(v, locale);
  const href = (patch: Record<string, string | null>) => {
    const s = new URLSearchParams();
    const cur: Record<string, string | null> = { tab: p.tab === "all" ? null : p.tab, q: p.q || null, lead: p.thread?.lead.id ?? null, campaign: p.campaign?.id ?? null, show: p.show, ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) s.set(k, v);
    return `/inbox${s.size ? `?${s}` : ""}`;
  };
  const I = t.ag.rx.inbox;
  const tabLabel = (k: InboxTab) => (k === "all" ? I.all : k === "needs_you" ? I.needsYou : x.tabs[k]);
  const tabHint = (k: InboxTab) => (k === "all" || k === "needs_you" ? undefined : x.tabHints[k]);
  const [week] = useState(() => Date.now() - 7 * 86_400_000);
  const groups = useMemo(() => [
    [x.thisWeek, p.items.filter((i) => Date.parse(i.at) >= week)],
    [x.earlier, p.items.filter((i) => Date.parse(i.at) < week)],
  ] as const, [p.items, week, x.thisWeek, x.earlier]);
  const date = (iso: string) => {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = Date.parse(iso) >= week ? { weekday: "short" } : { month: "short", day: "numeric" };
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { ...opts, ...(p.timeZone ? { timeZone: p.timeZone } : {}) }).format(d);
  };

  // Keyboard: J / K move, Enter opens, Esc back to the list.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setCursor((c) => Math.max(0, Math.min(p.items.length - 1, c + (e.key === "j" ? 1 : -1))));
      } else if (e.key === "Enter" && p.items[cursor]) router.push(href({ lead: p.items[cursor]!.leadId }));
      else if (e.key === "Escape" && p.thread) router.push(href({ lead: null }));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  return (
    <div className="sdr-page sdr-inbox-page">
      <header className="sdr-head">
        <div><h2>{x.title}</h2><p>{x.subtitle}</p></div>
      </header>
      {p.campaign && (
        <div className="sdr-live" role="status">
          <LiveRefresh active={p.campaign.active && p.campaign.writing > 0} />
          {p.campaign.active && p.campaign.writing > 0 ? <Loader2 className="spin" /> : <CheckCheck />}
          <Link className="sdr-live-name" href={`/outreach/${p.campaign.id}`}>{p.campaign.name}</Link>
          <span>{fmt(x.live.progress, { writing: n(p.campaign.writing), sent: n(p.campaign.sent), total: n(p.campaign.leads) })}</span>
          {p.campaign.failed > 0 && <span className="sdr-live-bad">{fmt(x.live.failed, { n: n(p.campaign.failed) })}</span>}
          <Link className="sdr-live-x" href="/inbox" aria-label={x.live.clear}><X size={14} /></Link>
        </div>
      )}
      <div className={`sdr-inbox${p.thread ? " has-thread" : ""}`}>
        <aside className="sdr-inbox-list">
          <div className="sdr-inbox-tools">
            <form method="get" action="/inbox" className="sdr-search" style={{ flex: 1, minWidth: 0 }}>
              {p.tab !== "all" && <input type="hidden" name="tab" value={p.tab} />}
              <Search /><input name="q" defaultValue={p.q} placeholder={x.search} aria-label={x.search} />
            </form>
          </div>
          <div className="sdr-inbox-filters">
            {/* D-274: one hub for every channel; email today, the others as Yolias adds them. */}
            <select className="sdr-input sm" aria-label={I.channel} value="email" onChange={() => {}}>
              <option value="email">{I.channels.email}</option>
            </select>
            <select className="sdr-input sm" aria-label={t.camp.inbox.filter} value={p.show ?? ""} onChange={(e) => router.push(href({ show: e.target.value || null, lead: null }))}>
              <option value="">{t.camp.inbox.all}</option>
              {INBOX_SHOWS.map((k) => <option key={k} value={k}>{{ interested: t.camp.inbox.interested, not_interested: t.camp.inbox.notInterested, needs_you: t.camp.inbox.needsYou, meeting_request: t.camp.inbox.meetingRequest, booked: t.camp.inbox.booked, replied: t.camp.inbox.replied, no_reply: t.camp.inbox.noReply }[k]}</option>)}
            </select>
            {p.campaigns.length > 0 && (
              <select className="sdr-input sm" aria-label={t.camp.prospects.campaign} value={p.campaign?.id ?? ""} onChange={(e) => router.push(href({ campaign: e.target.value || null, lead: null }))}>
                <option value="">{t.camp.prospects.anyCampaign}</option>
                {p.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <nav className="sdr-tabs sdr-inbox-tabs">
            {MAIN.map((k) => <Link key={k} href={href({ tab: k === "all" ? null : k, lead: null })} className={`${p.tab === k ? "active" : ""}${k === "needs_you" && p.counts.needs_you > 0 ? " needs" : ""}`} title={tabHint(k)}>{tabLabel(k)}{k === "needs_you" && p.counts.needs_you > 0 && <span className="sdr-count hot">{n(p.counts.needs_you)}</span>}</Link>)}
            <div className="sdr-menu">
              <button type="button" className={MORE.includes(p.tab) ? "active" : ""} aria-expanded={more} onClick={() => setMore((v) => !v)}>{MORE.includes(p.tab) ? tabLabel(p.tab) : t.sdr.common.more}<ChevronDown /></button>
              {more && <div className="sdr-menu-panel" role="menu">{MORE.map((k) => <Link key={k} href={href({ tab: k, lead: null })} onClick={() => setMore(false)} title={tabHint(k)}>{tabLabel(k)}<span className="sdr-count" style={{ marginInlineStart: "auto" }}>{n(p.counts[k])}</span></Link>)}</div>}
            </div>
          </nav>
          <div className="sdr-inbox-items">
            {!p.items.length && <div style={{ padding: 16 }}>{p.q || p.tab !== "all" ? <p className="sdr-panel-sub">{p.q ? t.sdr.leads.emptyFiltered : p.tab === "needs_you" ? I.empty : x.empty[p.tab as keyof typeof x.empty]}</p> : <EmptyNext text={I.allEmpty} href="/outreach" label={t.emptyNext.inbox} />}</div>}
            {groups.map(([label, rows]) => rows.length > 0 && (
              <div key={label}>
                <div className="sdr-inbox-group">{label}</div>
                {rows.map((i) => {
                  const idx = p.items.indexOf(i);
                  return (
                    <Link key={i.leadId} href={href({ lead: i.leadId })} className={`sdr-inbox-item${i.leadId === p.thread?.lead.id ? " active" : ""}${idx === cursor ? " cursor" : ""}${i.unread ? " unread" : ""}`}>
                      <span className="sdr-avatar plain">{initials(i.name)}</span>
                      <span className="sdr-inbox-item-main">
                        <span className="row"><strong dir="auto">{i.name}</strong>{i.company && <span className="co" dir="auto">{i.company}</span>}<time>{date(i.at)}</time></span>
                        {i.subject && <span className="subj" dir="auto">{i.subject}</span>}
                        <span className="prev" dir="auto">{i.preview}</span>
                        {(i.needsYou || i.hasDraft || i.status?.lastInbound) && <span className="chips">{i.needsYou && <span className="sdr-badge red nodot">{I.badge}</span>}{i.hasDraft && <span className="sdr-badge blue nodot"><PenLine size={11} />{x.aiDraft}</span>}{i.status?.lastInbound && <KindBadge kind={i.status.lastInbound.kind} />}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="sdr-panel-foot">{fmt(x.count, { n: n(p.items.length) })}</div>
        </aside>
        <section className="sdr-inbox-thread">
          {p.thread ? <Conversation {...p} thread={p.thread} backHref={href({ lead: null })} needsYou={Boolean(p.items.find((i) => i.leadId === p.thread!.lead.id)?.needsYou)} /> : (
            <div className="sdr-inbox-empty">
              <span className="sdr-stat-icon"><MailOpen /></span>
              <strong>{x.selectTitle}</strong>
              <p>{x.selectSub}</p>
              <p className="keys"><kbd>J</kbd><kbd>K</kbd> {x.keys} · <kbd>Enter</kbd> {x.keysOpen} · <kbd>Esc</kbd> {x.keysBack}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Conversation(p: Props & { thread: InboxThread; backHref: string; needsYou?: boolean }) {
  const { t, locale } = useI18n();
  const x = t.sdr.inbox;
  const router = useRouter();
  const toast = useToast();
  const ago = useAgo();
  const [pending, start] = useTransition();
  const [details, setDetails] = useState(true);
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [showDraft, setShowDraft] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const { lead } = p.thread;
  const s = p.status;
  useEffect(() => { if (lead.unread) void markThreadRead(lead.id); }, [lead.id, lead.unread]);
  // R opens the reply box, as in AgentSDR.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.key !== "r") return;
      e.preventDefault();
      setComposing(true);
      setTimeout(() => box.current?.focus(), 0);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  const status = lead.thread_status ?? "open";
  const done = p.thread.messages.filter((m) => m.status === "sent" || m.status === "received" || m.status === "failed" || (m.step_position && (m.status === "draft" || m.status === "approved")));
  const draftMsg = s?.draft ? p.thread.messages.find((m) => m.id === s.draft!.id) ?? null : null;
  const suggestion = !draftMsg ? s?.lastInbound?.suggestedReply ?? null : null;
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => start(async () => {
    const r = await fn();
    if (!r.ok) toast(r.error ?? t.ws.common.error, "error"); else if (ok) toast(ok);
    router.refresh();
  });
  const when = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(p.timeZone ? { timeZone: p.timeZone } : {}) }).format(new Date(iso)) : "-");

  return (
    <div className={`sdr-conv${details ? " with-details" : ""}`}>
      <div className="sdr-conv-main">
        <div className="sdr-conv-head">
          <Link className="sdr-back sdr-conv-back" href={p.backHref}><ChevronLeft className="flip-rtl" />{x.title}</Link>
          <span className="sdr-avatar plain">{initials(lead.name)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sdr-cell-main" style={{ fontSize: "1rem" }} dir="auto">{lead.name}</div>
            <div className="sdr-conv-sub">
              {s?.lastInbound && (
                <label className="sdr-kind-select" title={x.classify}>
                  <KindBadge kind={s.lastInbound.kind} /><ChevronDown size={12} />
                  <select aria-label={x.classify} value={s.lastInbound.kind === "unclassified" ? "" : s.lastInbound.kind} onChange={(e) => act(() => setReplyKind(lead.id, e.target.value), x.classified)}>
                    {s.lastInbound.kind === "unclassified" && <option value="">{t.sdr.kinds.unclassified}</option>}
                    {REPLY_KINDS.map((k) => <option key={k} value={k}>{t.sdr.kinds[k]}</option>)}
                  </select>
                </label>
              )}
              <span className="sdr-chip-inline"><Mail size={12} />{x.email}</span>
              {lead.company_name && lead.company_name !== lead.name && <span className="sdr-cell-sub" dir="auto" style={{ margin: 0 }}>{lead.company_name}</span>}
            </div>
          </div>
          <div className="sdr-head-actions">
            {status === "open"
              ? <button type="button" className="sdr-icon-btn bordered" disabled={pending} title={x.markDone} aria-label={x.markDone} onClick={() => act(() => setThreadStatus(lead.id, "done"))}><CheckCheck /></button>
              : <button type="button" className="sdr-icon-btn bordered" disabled={pending} title={x.reopen} aria-label={x.reopen} onClick={() => act(() => setThreadStatus(lead.id, "open"))}><RotateCcw /></button>}
            <button type="button" className={`sdr-icon-btn bordered${details ? " on" : ""}`} title={details ? x.hideDetails : x.details} aria-label={details ? x.hideDetails : x.details} aria-pressed={details} onClick={() => setDetails((d) => !d)}><PanelRight /></button>
          </div>
        </div>
        {p.needsYou && (
          <div className="sdr-needs-banner" role="status">
            <span>{t.ag.rx.inbox.banner}{s?.lastInbound?.summary ? ` ${s.lastInbound.summary}` : ""}</span>
            <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => act(() => markHandled(lead.id), t.ag.rx.inbox.handledToast)}><CheckCheck />{t.ag.rx.inbox.handled}</button>
          </div>
        )}
        <div className="sdr-conv-body">
          {!done.length && <p className="sdr-panel-sub">{t.ws.inbox.thread.noMessages}</p>}
          {done.map((m) => {
            const inbound = m.direction === "inbound";
            return (
              <article key={m.id} className={`sdr-mail${inbound ? " in" : ""}`}>
                <div className="sdr-mail-head">
                  <span className="sdr-avatar plain sm">{inbound ? initials(lead.name) : <UserRound size={14} />}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div><strong dir="auto">{inbound ? lead.name : x.you}</strong> <span className="sdr-cell-sub" style={{ display: "inline" }} dir="ltr">{inbound ? m.from_address ?? lead.email : m.from_address ?? p.mailboxEmail}</span></div>
                    <div className="sdr-cell-sub" dir="ltr">{x.to} {inbound ? p.mailboxEmail ?? "-" : m.to_email ?? lead.email}</div>
                  </div>
                  <time className="sdr-cell-sub" style={{ margin: 0 }}>{when(m.received_at ?? m.sent_at ?? m.created_at)}</time>
                </div>
                {m.subject && <div className="sdr-mail-subj" dir="auto">{m.subject}</div>}
                <div className="sdr-mail-body" dir="auto">{m.body}</div>
                {m.status === "failed" && m.error && <p className="form-error">{m.error}</p>}
                {!inbound && m.delivery_status === "bounced" && <span className="sdr-badge red">{t.ws.inbox.bounced}</span>}
              </article>
            );
          })}
          {(draftMsg || suggestion) && !lead.do_not_contact && (
            <div className="sdr-draft">
              <div className="sdr-draft-head">
                <span className="sdr-draft-icon"><PenLine /></span>
                <div style={{ flex: 1 }}><strong>{x.draftReady}</strong> <span className="sdr-cell-sub" style={{ display: "inline" }}>· {x.draftCheck}</span></div>
                <button type="button" className="sdr-btn primary sm" onClick={() => {
                  if (draftMsg) setShowDraft(true);
                  else { setBody(suggestion ?? ""); setComposing(true); setTimeout(() => box.current?.focus(), 0); }
                }}>{x.reviewDraft}</button>
              </div>
              {draftMsg && showDraft
                ? <MessageCard m={draftMsg as unknown as CardMessage} timeZone={p.timeZone} mailboxEmail={p.mailboxEmail} leadEmail={lead.email} />
                : <><div className="sdr-draft-preview" dir="auto">{(draftMsg?.body ?? suggestion ?? "").split("\n").slice(0, 2).join("\n")}</div>{draftMsg && <button type="button" className="sdr-link" onClick={() => setShowDraft(true)}>{x.showDraft}</button>}</>}
            </div>
          )}
        </div>
        <div className="sdr-conv-reply">
          {lead.do_not_contact ? <p className="sdr-panel-sub">{x.dnc}</p> : !composing ? (
            <button type="button" className="sdr-reply-bar" onClick={() => { setComposing(true); setTimeout(() => box.current?.focus(), 0); }}>
              <Reply size={15} /><span>{fmt(x.replyTo, { name: lead.name })}</span>{p.mailboxEmail && <span className="sdr-cell-sub" style={{ margin: 0 }} dir="ltr">{fmt(x.replyFrom, { email: p.mailboxEmail })}</span>}<kbd>R</kbd>
            </button>
          ) : (
            <div className="sdr-reply-box">
              {!p.hasMailbox && <p className="sdr-panel-sub">{x.noMailbox}</p>}
              <textarea ref={box} className="sdr-input" dir="auto" rows={5} value={body} maxLength={5000} placeholder={fmt(x.replyTo, { name: lead.name })} onChange={(e) => setBody(e.target.value)} />
              <div className="sdr-foot" style={{ marginTop: 0 }}>
                <button type="button" className="sdr-btn" disabled={pending} onClick={() => act(async () => { const r = await draftReplyAction(lead.id, body); if (r.ok) setBody(""); return r; }, t.ws.inbox.composer.draftReady)}><PenLine />{x.suggest}</button>
                <button type="button" className="sdr-btn primary" disabled={pending || !body.trim() || !p.hasMailbox} onClick={() => act(async () => { const r = await sendReply(lead.id, body); if (r.ok) { setBody(""); setComposing(false); } return r; }, x.sent)}><Send />{x.send}</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {details && (
        <aside className="sdr-conv-details">
          <div className="sdr-details-top">
            <span className="sdr-avatar plain lg">{initials(lead.name)}</span>
            <strong dir="auto">{lead.name}</strong>
            {lead.job_title && <span className="sdr-cell-sub" dir="auto">{lead.job_title}</span>}
            {lead.company_name && <span className="sdr-cell-sub" dir="auto">{lead.company_name}</span>}
            <div className="sdr-details-actions">
              {lead.linkedin_url && <a className="sdr-icon-btn bordered" href={lead.linkedin_url} target="_blank" rel="noreferrer" aria-label={x.linkedin}><LinkedInIcon /></a>}
              {lead.email && <a className="sdr-icon-btn bordered" href={`mailto:${lead.email}`} aria-label={x.email}><Mail /></a>}
            </div>
          </div>
          <dl className="sdr-dl">
            <dt className="h">{x.crm}</dt>
            <dt>{x.stage}</dt><dd>{t.ws.stages[lead.stage]}{s?.bucket ? ` · ${t.sdr.buckets[s.bucket]}` : ""}</dd>
            <dt>{x.sequence}</dt><dd>{s?.campaigns.length ? s.campaigns.map((c) => <Link key={c.id} href={`/outreach/${c.id}`} className="sdr-link">{c.name}</Link>) : x.none}</dd>
            <dt>{x.nextStep}</dt><dd>{s?.draft ? x.draftWaiting : s?.followUp ? fmt(x.nextFollowUp, { date: when(s.followUp.at) }) : x.none}</dd>
            <dt>{x.lastReply}</dt><dd>{ago(s?.lastInbound?.at) ?? x.none}</dd>
            <dt>{x.lastSent}</dt><dd>{ago(s?.lastOutbound?.at) ?? x.none}</dd>
            {/* What came of it, when there is no meeting to ask after (D-268: a meeting's outcome is asked in Meetings). */}
            {!lead.next_meeting_at && lead.stage !== "closed" && lead.stage !== "lost" && lead.stage !== "meeting_completed" && (
              <dd className="full sdr-outcome">
                <span>{t.meetings.outcome.ask}</span>
                <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => act(() => setOutcome(lead.id, true), t.meetings.saved)}>{t.meetings.outcome.won}</button>
                <select className="sdr-input sm" disabled={pending} value="" aria-label={t.meetings.outcome.lost} onChange={(e) => { const r = e.target.value; if (r) act(() => setOutcome(lead.id, false, r), t.meetings.saved); }}>
                  <option value="">{t.meetings.outcome.lost}</option>
                  {LOST_REASONS.map((r) => <option key={r} value={r}>{t.ws.crm.lostReasons[r]}</option>)}
                </select>
              </dd>
            )}
          </dl>
          <dl className="sdr-dl">
            <dt className="h">{x.conversation}</dt>
            <dt>{x.channel}</dt><dd><Mail size={12} /> {x.email}</dd>
            <dt>{x.mailbox}</dt><dd dir="ltr">{s?.lastOutbound?.from ?? p.mailboxEmail ?? x.none}</dd>
            <dt>{x.messages}</dt><dd>{formatNumber(s?.messages ?? done.length, locale)}</dd>
          </dl>
          <dl className="sdr-dl">
            <dt className="h">{x.contact}</dt>
            <dt>{x.email}</dt><dd dir="ltr">{lead.email ?? x.none}</dd>
            {lead.phone && <><dt>{x.phone}</dt><dd dir="ltr">{lead.phone}</dd></>}
            {lead.linkedin_url && <><dt>{x.linkedin}</dt><dd><a className="sdr-link" href={lead.linkedin_url} target="_blank" rel="noreferrer">{lead.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\//, "")} <ExternalLink size={11} /></a></dd></>}
          </dl>
          {p.thread.activity.length > 0 && (
            <dl className="sdr-dl">
              <dt className="h">{x.activity}</dt>
              {p.thread.activity.slice(0, 6).map((a) => <dd key={a.id} className="full"><span dir="auto">{a.body?.slice(0, 140) ?? t.ws.inbox.activity[a.kind as keyof typeof t.ws.inbox.activity] ?? a.kind}</span><span className="sdr-cell-sub">{when(a.created_at)}</span></dd>)}
            </dl>
          )}
          {p.thread.tasks.length > 0 && (
            <dl className="sdr-dl">
              <dt className="h">{x.reminders}</dt>
              {p.thread.tasks.map((k) => <dd key={k.id} className="full"><label style={{ display: "flex", gap: 8 }}><input type="checkbox" disabled={pending} onChange={() => act(() => setTaskDone(k.id, true))} /><span dir="auto">{k.title}</span></label></dd>)}
            </dl>
          )}
        </aside>
      )}
    </div>
  );
}
