"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookmarkMinus, ChevronLeft, ChevronRight, Download, Eye, Trash2, UsersRound, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { findDecisionMakersAction, peopleForActions, removeFromProspects, removeFromSaved, revealContacts, type Target } from "@/app/(app)/prospects/actions";
import { exportedPeople } from "@/app/(app)/prospects/message-actions";
import type { MessageChannel } from "@/types/database";
import type { GridPerson } from "./PeopleGrid";
import { ChannelIcon, MessageComposer, personRecipient } from "./ProspectActions";
import type { ProspectTab } from "@/services/prospects";

export interface TableRow {
  id: string;
  label: string;
  cells: ReactNode[];
}

interface Props {
  tab: ProspectTab;
  columns: string[];
  rows: TableRow[];
  total: number;
  page: number;
  pageSize: number;
  /** The active filters as a query string (no page). */
  query: string;
  empty: string;
}

// One Prospects tab: rows with checkboxes, "select all on this page" and
// "select all N matching" (across pages), a bulk bar for the selection, and
// pagination. Bulk actions send ids or the filters, never row data.
export function EntityTable({ tab, columns, rows, total, page, pageSize, query, empty }: Props) {
  const { t, locale } = useI18n();
  const pr = t.prospects;
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [pending, start] = useTransition();
  const exportForm = useRef<HTMLFormElement>(null);
  // Email / LinkedIn for the selected people (D-155): their cards are loaded, then the composer opens.
  const [compose, setCompose] = useState<{ channel: MessageChannel; people: GridPerson[] } | null>(null);
  const message = (channel: MessageChannel) => start(async () => setCompose({ channel, people: await peopleForActions(target()) }));
  const n = (v: number) => formatNumber(v, locale);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageAll = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const count = allMatching ? total : selected.size;
  const target = (): Target => (allMatching ? { all: query } : { ids: [...selected] });
  const href = (p: number) => `/prospects?${[query, p > 1 ? `page=${p}` : ""].filter(Boolean).join("&")}`;

  const toggle = (id: string) => {
    setAllMatching(false);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const togglePage = () => {
    setAllMatching(false);
    setSelected(pageAll ? new Set() : new Set(rows.map((r) => r.id)));
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
    <div className="data-table-card">
      {count > 0 && (
        <div className="bulk-bar" role="region" aria-label={fmt(pr.selected, { count: n(count) })}>
          <strong>{fmt(pr.selected, { count: n(count) })}</strong>
          {pageAll && !allMatching && total > rows.length && (
            <span className="bulk-note">{fmt(pr.allOnPage, { count: n(rows.length) })} <button type="button" className="link-button" onClick={() => setAllMatching(true)}>{fmt(pr.selectAllMatching, { count: n(total) })}</button></span>
          )}
          {allMatching && <span className="bulk-note">{fmt(pr.allMatchingSelected, { count: n(total) })}</span>}
          <span className="bulk-actions">
            {tab === "people" && (
              <>
                {(["email", "linkedin", "whatsapp", "facebook", "instagram"] as const).map((c, i) => (
                  <button key={c} type="button" className={i === 0 ? "btn-primary" : "btn-secondary"} disabled={pending} onClick={() => message(c)}><ChannelIcon channel={c} /> {t.outreach[c]}</button>
                ))}
              </>
            )}
            <button type="button" className="btn-secondary" onClick={() => {
              exportForm.current?.requestSubmit();
              if (tab === "people") void exportedPeople(count, "prospects");
            }}><Download /> {pr.exportSelected}</button>
            {tab === "people" && (
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(async () => ((await revealContacts(target())).ok ? pr.revealed : null))}><Eye /> {pr.revealContacts}</button>
            )}
            {(tab === "companies" || tab === "local") && (
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(async () => {
                const r = await findDecisionMakersAction(target(), tab);
                return r.ok ? fmt(pr.findPeopleQueued, { count: n(r.queued) }) : null;
              })}><UsersRound /> {pr.findPeople}</button>
            )}
            {tab === "saved" && (
              <button type="button" className="btn-danger-ghost" disabled={pending} onClick={() => run(async () => {
                const r = await removeFromSaved(target());
                return r.ok ? fmt(pr.removedSaved, { count: n(r.removed) }) : null;
              })}><BookmarkMinus /> {pr.removeSaved}</button>
            )}
            {tab !== "jobs" && tab !== "saved" && (
              <button type="button" className="btn-danger-ghost" disabled={pending} onClick={() => run(async () => {
                const r = await removeFromProspects(target(), tab);
                return r.ok ? fmt(pr.removed, { count: n(r.removed) }) : null;
              })}><Trash2 /> {pr.remove}</button>
            )}
            <button type="button" className="btn-secondary" onClick={clear}><X /> {pr.clearSelection}</button>
          </span>
          {compose && <MessageComposer recipients={compose.people.map(personRecipient)} channel={compose.channel} onClose={() => setCompose(null)} />}
          <form ref={exportForm} method="post" action="/prospects/export" hidden>
            <input type="hidden" name="query" value={query} />
            {allMatching ? <input type="hidden" name="all" value="1" /> : [...selected].map((id) => <input key={id} type="hidden" name="id" value={id} />)}
          </form>
        </div>
      )}

      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="select-cell">
                <input type="checkbox" aria-label={pr.selectAllPage} checked={pageAll} disabled={!rows.length} onChange={togglePage} />
              </th>
              {columns.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="empty-cell">{empty}</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={allMatching || selected.has(r.id) ? "selected" : undefined}>
                <td className="select-cell">
                  <input type="checkbox" aria-label={fmt(pr.selectRow, { name: r.label })} checked={allMatching || selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                {r.cells.map((cell, i) => <td key={i}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="table-pager">
          <span>{fmt(pr.showing, { from: n((page - 1) * pageSize + 1), to: n(Math.min(page * pageSize, total)), total: n(total) })}</span>
          <span className="table-pager-nav">
            {page > 1 ? <Link className="btn-secondary" href={href(page - 1)}><ChevronLeft className="flip-rtl" /> {pr.prev}</Link> : <span className="btn-secondary" aria-disabled="true"><ChevronLeft className="flip-rtl" /> {pr.prev}</span>}
            <span>{fmt(pr.page, { page: n(page), pages: n(pages) })}</span>
            {page < pages ? <Link className="btn-secondary" href={href(page + 1)}>{pr.next} <ChevronRight className="flip-rtl" /></Link> : <span className="btn-secondary" aria-disabled="true">{pr.next} <ChevronRight className="flip-rtl" /></span>}
          </span>
        </div>
      )}
    </div>
  );
}

/** A person's contact details, masked until a member reveals them (recorded). */
export function ContactCell({ id, masked, linkedin }: { id: string; masked: { email: string | null; phone: string | null; verified: boolean }; linkedin: string | null }) {
  const { t } = useI18n();
  const c = t.channels;
  const [shown, setShown] = useState<{ email: string | null; phone: string | null } | null>(null);
  const [pending, start] = useTransition();
  if (!masked.email && !masked.phone && !linkedin) return <span className="cell-sub">—</span>;
  const email = shown ? shown.email : masked.email;
  const phone = shown ? shown.phone : masked.phone;
  return (
    <div className="contact-cell">
      {email && (shown ? <a href={`mailto:${email}`} dir="ltr">{email}{masked.verified ? " ✓" : ""}</a> : <span dir="ltr">{email}{masked.verified ? " ✓" : ""}</span>)}
      {phone && (shown ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} dir="ltr">{phone}</a> : <span dir="ltr">{phone}</span>)}
      {linkedin && <a className="badge-chan chan-in" href={linkedin} target="_blank" rel="noreferrer">{c.linkedin}</a>}
      {!shown && (masked.email || masked.phone) && (
        <button type="button" className="link-button" disabled={pending} onClick={() => start(async () => {
          const r = await revealContacts({ ids: [id] });
          if (r.ok) setShown(r.contacts.find((x) => x.id === id) ?? null);
        })}>{t.prospects.reveal}</button>
      )}
    </div>
  );
}

/** Decision-maker matching state of a saved company. */
export function PeopleStatus({ status, found, requested }: { status: string | null; found: number; requested: boolean }) {
  const { t, locale } = useI18n();
  const s = t.prospects.peopleStatus;
  if (!status) return requested ? <span className="cell-sub">{s.queued}</span> : <span className="cell-sub">—</span>;
  const label = status === "done" ? fmt(s.done, { count: formatNumber(found, locale) }) : s[status as keyof typeof s];
  return <span className={`cell-sub people-${status}`}>{label}</span>;
}
