"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookmarkMinus, ChevronLeft, ChevronRight, Download, Eye, Mail, Phone, Send, SquareKanban, Trash2, UsersRound, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { addSelectionToCampaign, addSelectionToCrm, findDecisionMakersAction, openOutreachCampaigns, peopleForActions, removeFromProspects, removeFromSaved, revealContacts, sendSelectionAsCampaign, type Target } from "@/app/(app)/prospects/actions";
import { exportedPeople } from "@/app/(app)/prospects/message-actions";
import type { MessageChannel } from "@/types/database";
import type { ProspectTab } from "@/services/prospects";
import { CompanyLogo, PersonAvatar } from "./Media";
import type { GridPerson } from "./PeopleGrid";
import { ChannelIcon, MessageComposer, personRecipient } from "./ProspectActions";
import { LinkedInIcon } from "./ConnectorIcons";

/** One row of the Prospects table, prepared on the server (contacts never leave it here). */
export interface TableRow {
  key: string;
  kind: "person" | "company" | "local_business";
  href: string;
  name: string;
  /** A person's title, or the company's domain. */
  sub: string | null;
  imageUrl: string | null;
  domain: string | null;
  company: string | null;
  companyHref: string | null;
  industry: string | null;
  location: string | null;
  employees: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  linkedinUrl: string | null;
  match: number | null;
  added: string;
  imported: boolean;
  /** Where this prospect stands in outreach (D-234). */
  outreach: "new" | "in_campaign" | "contacted" | "replied" | "do_not_contact";
}

interface Props {
  tab: ProspectTab;
  rows: TableRow[];
  total: number;
  page: number;
  pageSize: number;
  /** The active filters as a query string (no page). */
  query: string;
  empty: string;
  /** A source for decision makers is connected. */
  canCollect: boolean;
}

// The Prospects table (owner brief 2026-10-12): companies, local businesses
// and people in one table, like Clay / Instantly. A checkbox on every row,
// "select all on this page" and "select all N matching" (across pages), a
// floating bar for the selection and pagination. Bulk actions send row keys
// or the filters, never row data; each action uses the kinds it applies to.
export function ProspectTable({ tab, rows, total, page, pageSize, query, empty, canCollect }: Props) {
  const { t, locale } = useI18n();
  const pr = t.prospects;
  const tb = pr.table;
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [pending, start] = useTransition();
  const exportForm = useRef<HTMLFormElement>(null);
  const [picker, setPicker] = useState<{ id: string; name: string; status: string }[] | null>(null);
  const [compose, setCompose] = useState<{ channel: MessageChannel; people: GridPerson[] } | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageAll = rows.length > 0 && rows.every((r) => selected.has(r.key));
  const count = allMatching ? total : selected.size;
  const target = (): Target => (allMatching ? { all: query } : { ids: [...selected] });
  const href = (p: number) => `/prospects?${[query, p > 1 ? `page=${p}` : ""].filter(Boolean).join("&")}`;
  const chosen = rows.filter((r) => selected.has(r.key));
  // What the selection holds decides which actions apply.
  const hasPeople = allMatching ? tab === "all" || tab === "people" || tab === "saved" : chosen.some((r) => r.kind === "person");
  const hasCompanies = allMatching ? tab !== "people" : chosen.some((r) => r.kind !== "person");
  const message = (channel: MessageChannel) => start(async () => setCompose({ channel, people: await peopleForActions(target()) }));

  const toggle = (key: string) => {
    setAllMatching(false);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const togglePage = () => {
    setAllMatching(false);
    setSelected(pageAll ? new Set() : new Set(rows.map((r) => r.key)));
  };
  const clear = () => {
    setSelected(new Set());
    setAllMatching(false);
  };
  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      const msg = await fn();
      if (msg) toast(msg);
      clear();
      router.refresh();
    });

  return (
    <div className="prospect-table">
      {rows.length > 0 && (pageAll && total > rows.length || allMatching) && (
        <div className="prospect-table-note">
          {pageAll && !allMatching && total > rows.length && (
            <button type="button" className="link-button" onClick={() => setAllMatching(true)}>{fmt(pr.selectAllMatching, { count: n(total) })}</button>
          )}
          {allMatching && <span className="cell-sub">{fmt(pr.allMatchingSelected, { count: n(total) })}</span>}
        </div>
      )}

      <div className="data-table-card">
        <div className="data-table-scroll">
          <table className="data-table prospects-data-table">
            <thead>
              <tr>
                <th className="col-check"><input type="checkbox" checked={pageAll} onChange={togglePage} aria-label={pr.selectAllPage} disabled={!rows.length} /></th>
                <th>{tb.colName}</th>
                <th>{tb.colType}</th>
                <th>{tb.colCompany}</th>
                <th>{tb.colIndustry}</th>
                <th>{tb.colLocation}</th>
                <th>{tb.colEmployees}</th>
                <th>{tb.colContact}</th>
                <th>{tb.colOutreach}</th>
                <th>{tb.colMatch}</th>
                <th>{tb.colAdded}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={11} className="empty-cell">{empty}</td></tr>}
              {rows.map((r) => {
                const on = allMatching || selected.has(r.key);
                return (
                  <tr key={r.key} className={on ? "selected" : undefined}>
                    <td className="col-check"><input type="checkbox" checked={on} onChange={() => toggle(r.key)} aria-label={fmt(pr.selectRow, { name: r.name })} /></td>
                    <td>
                      <Link className="prospect-name-cell" href={r.href}>
                        {r.kind === "person" ? <PersonAvatar name={r.name} photoUrl={r.imageUrl} size={30} /> : <CompanyLogo name={r.name} logoUrl={r.imageUrl} domain={r.domain} size={30} />}
                        <span className="prospect-name-text">
                          <strong>{r.name}</strong>
                          {r.sub && <span className="cell-sub" dir="auto">{r.sub}</span>}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`type-pill type-${r.kind}`}>{pr.csv.types[r.kind]}</span>
                      {r.imported && <span className="cell-sub">{tb.imported}</span>}
                    </td>
                    <td>{r.company ? (r.companyHref ? <Link className="entity-link" href={r.companyHref}>{r.company}</Link> : r.company) : <span className="cell-sub">—</span>}</td>
                    <td>{r.industry ?? <span className="cell-sub">—</span>}</td>
                    <td>{r.location ?? <span className="cell-sub">—</span>}</td>
                    <td dir="ltr" className="text-start">{r.employees ?? <span className="cell-sub">—</span>}</td>
                    <td>
                      <span className="contact-icons">
                        {r.hasEmail && <span title={tb.hasEmail} aria-label={tb.hasEmail}><Mail /></span>}
                        {r.hasPhone && <span title={tb.hasPhone} aria-label={tb.hasPhone}><Phone /></span>}
                        {r.linkedinUrl && <a href={r.linkedinUrl} target="_blank" rel="noreferrer" title={tb.hasLinkedin} aria-label={tb.hasLinkedin}><LinkedInIcon /></a>}
                        {!r.hasEmail && !r.hasPhone && !r.linkedinUrl && <span className="cell-sub">—</span>}
                      </span>
                    </td>
                    <td><span className={`outreach-state ${r.outreach}`}>{tb.outreach[r.outreach]}</span></td>
                    <td>{r.match != null ? `${r.match}%` : <span className="cell-sub">—</span>}</td>
                    <td className="cell-sub">{r.added}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {total > pageSize && (
        <div className="table-pager prospect-pager">
          <span>{fmt(pr.showing, { from: n((page - 1) * pageSize + 1), to: n(Math.min(page * pageSize, total)), total: n(total) })}</span>
          <span className="table-pager-nav">
            {page > 1 ? <Link className="btn-secondary" href={href(page - 1)}><ChevronLeft className="flip-rtl" /> {pr.prev}</Link> : <span className="btn-secondary" aria-disabled="true"><ChevronLeft className="flip-rtl" /> {pr.prev}</span>}
            <span>{fmt(pr.page, { page: n(page), pages: n(pages) })}</span>
            {page < pages ? <Link className="btn-secondary" href={href(page + 1)}>{pr.next} <ChevronRight className="flip-rtl" /></Link> : <span className="btn-secondary" aria-disabled="true">{pr.next} <ChevronRight className="flip-rtl" /></span>}
          </span>
        </div>
      )}

      {count > 0 && (
        <div className="selection-bar" role="region" aria-label={fmt(pr.selected, { count: n(count) })}>
          <span className="selection-count">{fmt(pr.selected, { count: n(count) })}</span>
          {/* Compact bar (owner brief 2026-10-19): one main action, the rest as icons with a label on hover. */}
          <span className="selection-actions">
            <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => setPicker(await openOutreachCampaigns()))}><Send /> {t.ws.outreach.send.button}</button>
            {hasPeople && (["email", "linkedin"] as const).map((c) => (
              <button key={c} type="button" className="btn-secondary icon-only" aria-label={t.outreach[c]} title={t.outreach[c]} disabled={pending} onClick={() => message(c)}><ChannelIcon channel={c} /></button>
            ))}
            {/* CRM and Outreach (D-193, D-195): the same people / companies, one lead each. */}
            <button type="button" className="btn-secondary icon-only" aria-label={t.ws.crm.addToCrm} title={t.ws.crm.addToCrm} disabled={pending} onClick={() => run(async () => {
              const r = await addSelectionToCrm(target());
              if (!r.ok) { toast(r.error, "error"); return null; }
              return r.message;
            })}><SquareKanban /></button>
            <button type="button" className="btn-secondary icon-only" aria-label={t.outreach.exportCsv} title={t.outreach.exportCsv} onClick={() => {
              exportForm.current?.requestSubmit();
              if (hasPeople) void exportedPeople(count, "prospects");
            }}><Download /></button>
            {hasPeople && (
              <button type="button" className="btn-secondary icon-only" aria-label={pr.revealContacts} title={pr.revealContacts} disabled={pending} onClick={() => run(async () => ((await revealContacts(target())).ok ? pr.revealed : null))}><Eye /></button>
            )}
            {canCollect && hasCompanies && (
              <button type="button" className="btn-secondary icon-only" aria-label={pr.findPeople} title={pr.findPeople} disabled={pending} onClick={() => run(async () => {
                const r = await findDecisionMakersAction(target());
                return r.ok ? fmt(pr.findPeopleQueued, { count: n(r.queued) }) : null;
              })}><UsersRound /></button>
            )}
            {tab === "saved" ? (
              <button type="button" className="btn-danger-ghost" disabled={pending} onClick={() => run(async () => {
                const r = await removeFromSaved(target());
                return r.ok ? fmt(pr.removedSaved, { count: n(r.removed) }) : null;
              })} aria-label={pr.removeSaved} title={pr.removeSaved}><BookmarkMinus /></button>
            ) : (
              <button type="button" className="btn-danger-ghost" disabled={pending} onClick={() => run(async () => {
                const r = await removeFromProspects(target());
                return r.ok ? fmt(pr.removed, { count: n(r.removed) }) : null;
              })} aria-label={pr.remove} title={pr.remove}><Trash2 /></button>
            )}
          </span>
          <button type="button" className="icon-btn selection-clear" aria-label={pr.clearSelection} title={pr.clearSelection} onClick={clear}><X /></button>
          <form ref={exportForm} method="post" action="/prospects/export" hidden>
            <input type="hidden" name="query" value={query} />
            {allMatching ? <input type="hidden" name="all" value="1" /> : [...selected].map((id) => <input key={id} type="hidden" name="id" value={id} />)}
          </form>
        </div>
      )}
      {picker && (
        <SendDialog count={count} campaigns={picker} pending={pending} onClose={() => setPicker(null)}
          onCreate={(input) => { setPicker(null); run(async () => {
            const r = await sendSelectionAsCampaign(target(), input);
            if (!r.ok) { toast(r.error, "error"); return null; }
            router.push(`/outreach/${r.id}`);
            return r.message ?? null;
          }); }}
          onPick={(id) => { setPicker(null); run(async () => {
            const r = await addSelectionToCampaign(id, target());
            if (!r.ok) { toast(r.error, "error"); return null; }
            return r.message ?? null;
          }); }} />
      )}
      {compose && <MessageComposer recipients={compose.people.map(personRecipient)} channel={compose.channel} onClose={() => setCompose(null)} />}
    </div>
  );
}

/**
 * Prospects → Send (owner brief 2026-10-19): name a new campaign and pick the
 * channel — Yolias creates it, starts it and prepares the first messages —
 * or add the selection to a campaign that already exists.
 */
function SendDialog({ count, campaigns, pending, onClose, onCreate, onPick }: {
  count: number; campaigns: { id: string; name: string; status: string }[]; pending: boolean;
  onClose: () => void; onCreate: (input: { name: string; channel: MessageChannel }) => void; onPick: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const o = t.ws.outreach;
  const [name, setName] = useState(() => fmt(o.send.defaultName, { date: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { day: "numeric", month: "short" }).format(new Date()) }));
  const [channel, setChannel] = useState<MessageChannel>("email");
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ws-modal send-dialog" role="dialog" aria-modal="true" aria-labelledby="send-title">
        <div className="ws-modal-head">
          <h3 id="send-title">{fmt(o.send.title, { count: formatNumber(count, locale) })}</h3>
          <button className="modal-close-btn" type="button" aria-label={t.common.close} onClick={onClose}><X /></button>
        </div>
        <p className="ws-muted">{o.send.lead}</p>
        <div className="ws-grid-2">
          <div className="ws-field"><label className="ws-label" htmlFor="send-name">{o.send.name}</label>
            <input id="send-name" className="form-input" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} /></div>
          <div className="ws-field"><label className="ws-label" htmlFor="send-channel">{o.send.channel}</label>
            <select id="send-channel" className="form-select" value={channel} onChange={(e) => setChannel(e.target.value as MessageChannel)}>
              {(["email", "linkedin"] as const).map((c) => <option key={c} value={c}>{o.channels[c]}</option>)}
            </select></div>
        </div>
        <div className="ws-actions">
          <button className="btn-primary" type="button" disabled={pending || !name.trim()} onClick={() => onCreate({ name: name.trim(), channel })}><Send /> {o.send.start}</button>
        </div>
        {campaigns.length > 0 && (
          <>
            <p className="ws-label send-dialog-or">{o.send.orExisting}</p>
            <div className="ws-pick-list">
              {campaigns.map((c) => (
                <button key={c.id} type="button" className="menu-item" disabled={pending} onClick={() => onPick(c.id)}>
                  <Send /> <span>{c.name}</span> <span className="cell-sub">{o.status[c.status as keyof typeof o.status]}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
