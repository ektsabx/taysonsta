"use client";

import { useRef, useState, useTransition } from "react";
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
import type { ProspectTab } from "@/services/prospects";
import { CompanyCard, PersonCard, type CardCompany } from "./Cards";
import { AvatarStack } from "./Media";
import type { GridPerson } from "./PeopleGrid";
import { ChannelIcon, MessageComposer, personRecipient } from "./ProspectActions";

export type GridItem =
  | { key: string; kind: "person"; person: GridPerson }
  | { key: string; kind: "company"; company: CardCompany };

interface Props {
  tab: ProspectTab;
  items: GridItem[];
  total: number;
  page: number;
  pageSize: number;
  /** The active filters as a query string (no page). */
  query: string;
  empty: string;
}

// One Prospects tab as cards (owner's reference design, the same cards as the
// search results): a checkbox on every card, "select all on this page" and
// "select all N matching" (across pages), a floating bar for the selection
// and pagination. Bulk actions send ids or the filters, never row data.
export function ProspectGrid({ tab, items, total, page, pageSize, query, empty }: Props) {
  const { t, locale } = useI18n();
  const pr = t.prospects;
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [pending, start] = useTransition();
  const exportForm = useRef<HTMLFormElement>(null);
  // Messages for the selected people (D-155 / D-160): their cards are loaded, then the composer opens.
  const [compose, setCompose] = useState<{ channel: MessageChannel; people: GridPerson[] } | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageAll = items.length > 0 && items.every((i) => selected.has(i.key));
  const count = allMatching ? total : selected.size;
  const target = (): Target => (allMatching ? { all: query } : { ids: [...selected] });
  const href = (p: number) => `/prospects?${[query, p > 1 ? `page=${p}` : ""].filter(Boolean).join("&")}`;
  const message = (channel: MessageChannel) => start(async () => setCompose({ channel, people: await peopleForActions(target()) }));
  const chosen = items.filter((i) => selected.has(i.key));
  const faces = chosen.map((i) => (i.kind === "person" ? { name: i.person.name, photoUrl: i.person.photoUrl } : { name: i.company.name, photoUrl: i.company.logoUrl }));

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
    setSelected(pageAll ? new Set() : new Set(items.map((i) => i.key)));
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
    <div className="prospect-grid">
      {items.length > 0 && (
        <div className="people-grid-head prospect-grid-head">
          <label className="select-all"><input type="checkbox" checked={pageAll} onChange={togglePage} /> {pr.selectAllPage}</label>
          {pageAll && !allMatching && total > items.length && (
            <button type="button" className="link-button" onClick={() => setAllMatching(true)}>{fmt(pr.selectAllMatching, { count: n(total) })}</button>
          )}
          {allMatching && <span className="cell-sub">{fmt(pr.allMatchingSelected, { count: n(total) })}</span>}
        </div>
      )}

      {items.length === 0 ? (
        <p className="result-card prospect-grid-empty cell-sub">{empty}</p>
      ) : (
        <ul className="people-grid">
          {items.map((i) => i.kind === "person"
            ? <PersonCard key={i.key} person={i.person} selected={allMatching || selected.has(i.key)} onToggle={() => toggle(i.key)} />
            : <CompanyCard key={i.key} company={i.company} selected={allMatching || selected.has(i.key)} onToggle={() => toggle(i.key)} />)}
        </ul>
      )}

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
          {faces.length > 0 && <AvatarStack people={faces} max={3} size={30} />}
          <span>{fmt(pr.selected, { count: n(count) })}</span>
          <span className="selection-actions">
            {tab === "people" && (["email", "linkedin", "whatsapp", "facebook", "instagram"] as const).map((c, k) => k === 0
              ? <button key={c} type="button" className="btn-primary" disabled={pending} onClick={() => message(c)}><ChannelIcon channel={c} /> {t.outreach[c]}</button>
              : <button key={c} type="button" className="btn-secondary icon-only" aria-label={t.outreach[c]} title={t.outreach[c]} disabled={pending} onClick={() => message(c)}><ChannelIcon channel={c} /></button>)}
            <button type="button" className="btn-secondary" onClick={() => {
              exportForm.current?.requestSubmit();
              if (tab === "people") void exportedPeople(count, "prospects");
            }}><Download /> {t.outreach.exportCsv}</button>
            {tab === "people" && (
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(async () => ((await revealContacts(target())).ok ? pr.revealed : null))}><Eye /> {pr.revealContacts}</button>
            )}
            {(tab === "companies" || tab === "local") && (
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(async () => {
                const r = await findDecisionMakersAction(target(), tab);
                return r.ok ? fmt(pr.findPeopleQueued, { count: n(r.queued) }) : null;
              })}><UsersRound /> {pr.findPeople}</button>
            )}
            {tab === "saved" ? (
              <button type="button" className="btn-danger-ghost" disabled={pending} onClick={() => run(async () => {
                const r = await removeFromSaved(target());
                return r.ok ? fmt(pr.removedSaved, { count: n(r.removed) }) : null;
              })} aria-label={pr.removeSaved} title={pr.removeSaved}><BookmarkMinus /></button>
            ) : tab !== "jobs" && (
              <button type="button" className="btn-danger-ghost" disabled={pending} onClick={() => run(async () => {
                const r = await removeFromProspects(target(), tab);
                return r.ok ? fmt(pr.removed, { count: n(r.removed) }) : null;
              })} aria-label={pr.remove} title={pr.remove}><Trash2 /></button>
            )}
            <button type="button" className="icon-btn" aria-label={pr.clearSelection} title={pr.clearSelection} onClick={clear}><X /></button>
          </span>
          <form ref={exportForm} method="post" action="/prospects/export" hidden>
            <input type="hidden" name="query" value={query} />
            {allMatching ? <input type="hidden" name="all" value="1" /> : [...selected].map((id) => <input key={id} type="hidden" name="id" value={id} />)}
          </form>
        </div>
      )}
      {compose && <MessageComposer recipients={compose.people.map(personRecipient)} channel={compose.channel} onClose={() => setCompose(null)} />}
    </div>
  );
}
