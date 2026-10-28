"use client";

import { EmptyNext } from "@/components/app/EmptyNext";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, BookmarkMinus, ChevronLeft, ChevronRight, Download, ExternalLink, Eye, Globe, Mail, Phone, Send, SquareKanban, Trash2, UsersRound, X } from "lucide-react";
import { AIMS, aimUsesLink } from "@/lib/outreach/aim";
import type { CampaignAim } from "@/types/acquisition";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { addSelectionToCampaign, addSelectionToCrm, findDecisionMakersAction, openOutreachCampaigns, removeFromProspects, removeFromSaved, revealContacts, sendSelectionAsCampaign, type Target } from "@/app/(app)/prospects/actions";
import { exportedPeople } from "@/app/(app)/prospects/message-actions";
import type { Bucket, ReplyKind } from "@/services/pipeline";
import { RowMenu } from "./sdr/bits";
import { CompanyLogo, PersonAvatar } from "./Media";
import { LinkedInIcon } from "./ConnectorIcons";

/** One row of the Prospects table, prepared on the server (contacts never leave it here). */
export interface TableRow {
  key: string;
  kind: "person" | "company" | "local_business";
  href: string;
  name: string;
  /** A person's job title. */
  title: string | null;
  imageUrl: string | null;
  domain: string | null;
  /** People: their company. */
  company: string | null;
  companyHref: string | null;
  companyDomain: string | null;
  companyLogo: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  linkedinUrl: string | null;
  website: string | null;
  /** Campaigns this prospect is in (Outreach column). */
  campaigns: { id: string; name: string }[];
  /** Where the lead stands (CRM column); null before it's a lead. */
  crm: { stage: string; kind: ReplyKind | null; bucket: Bucket | null; followUpAt: string | null; doNotContact: boolean; contacted: boolean } | null;
  /** Companies: saved people at this company. */
  people: number;
  updated: string;
}

interface Props {
  tab: "people" | "companies";
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

// Prospects (D-256, after AgentSDR Leads): a People tab (name and title,
// company, reach, outreach, CRM) and a Companies tab (company, people,
// outreach, links, updated). A checkbox on every row, "select all N
// matching" across pages and the floating bar for bulk actions stay (Send,
// CRM, export, reveal, find people, remove): they send row keys or the
// filters, never row data.
export function ProspectTable({ tab, rows, total, page, pageSize, query, empty, canCollect }: Props) {
  const { t, locale } = useI18n();
  const pr = t.prospects;
  const L = t.sdr.leads;
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [pending, start] = useTransition();
  const exportForm = useRef<HTMLFormElement>(null);
  const [picker, setPicker] = useState<{ id: string; name: string; status: string }[] | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageAll = rows.length > 0 && rows.every((r) => selected.has(r.key));
  const count = allMatching ? total : selected.size;
  const target = (): Target => (allMatching ? { all: query } : { ids: [...selected] });
  const href = (p: number) => `/prospects?${[query, p > 1 ? `page=${p}` : ""].filter(Boolean).join("&")}`;
  const sortHref = (s: string) => `/prospects?${[query.split("&").filter((x) => x && !x.startsWith("sort=")).join("&"), s ? `sort=${s}` : ""].filter(Boolean).join("&")}`;
  const sortNow = new URLSearchParams(query).get("sort") ?? "match";
  const hasPeople = tab === "people";
  const hasCompanies = tab === "companies";

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
  const one = (key: string, fn: (target: Target) => Promise<string | null>) =>
    start(async () => { const msg = await fn({ ids: [key] }); if (msg) toast(msg); router.refresh(); });
  const sortTh = (label: string, s: string) => (
    <th><Link className="sdr-sort" href={sortHref(sortNow === s ? "" : s)}>{label}<ArrowUpDown /></Link></th>
  );

  const rowMenu = (r: TableRow) => (
    <RowMenu label={t.sdr.common.more}>{(close) => (<>
      <Link href={r.href} onClick={close}><ExternalLink />{L.menu.open}</Link>
      <button type="button" onClick={() => { close(); setSelected(new Set([r.key])); setAllMatching(false); start(async () => setPicker(await openOutreachCampaigns())); }}><Send />{L.menu.send}</button>
      <button type="button" onClick={() => { close(); one(r.key, async (tg) => { const x = await addSelectionToCrm(tg); if (!x.ok) { toast(x.error, "error"); return null; } return x.message; }); }}><SquareKanban />{L.menu.crm}</button>
      {r.kind === "person" && <button type="button" onClick={() => { close(); one(r.key, async (tg) => ((await revealContacts(tg)).ok ? pr.revealed : null)); }}><Eye />{L.menu.reveal}</button>}
      <hr />
      <button type="button" className="danger" onClick={() => { close(); one(r.key, async (tg) => { const x = await removeFromProspects(tg); return x.ok ? fmt(pr.removed, { count: n(x.removed) }) : null; }); }}><Trash2 />{L.menu.remove}</button>
    </>)}</RowMenu>
  );

  const outreachCell = (r: TableRow) => (
    r.campaigns.length ? (
      <span className="sdr-outreach"><span className="sdr-chan"><Mail /></span><span className="sdr-ellipsis">{r.campaigns[0]!.name}</span>{r.campaigns.length > 1 && <span className="sdr-count">{fmt(t.sdr.common.plus, { n: r.campaigns.length - 1 })}</span>}</span>
    ) : <span className="sdr-cell-sub">{L.notInCampaign}</span>
  );

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

      <div className="sdr-table-wrap sdr-table-inset">
        <table className="sdr-table mobile-cards with-check">
          <thead>
            <tr>
              <th className="col-check"><input type="checkbox" checked={pageAll} onChange={togglePage} aria-label={pr.selectAllPage} disabled={!rows.length} /></th>
              {tab === "people" ? (<>
                {sortTh(L.colName, "name")}
                <th>{L.colCompany}</th>
                <th>{L.colReach}</th>
                <th>{L.colOutreach}</th>
                <th>{L.colCrm}</th>
              </>) : (<>
                {sortTh(L.colCompany, "name")}
                <th className="num">{L.colPeople}</th>
                <th>{L.colOutreach}</th>
                <th>{L.colLinks}</th>
                {sortTh(L.colUpdated, "newest")}
              </>)}
              <th aria-label={t.sdr.common.more} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty">{query ? empty : <EmptyNext text={empty} href="/" label={t.emptyNext.prospects} />}</td></tr>}
            {rows.map((r) => {
              const on = allMatching || selected.has(r.key);
              return (
                <tr key={r.key} className={`clickable${on ? " selected" : ""}`} onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button,input,label")) router.push(r.href); }}>
                  <td className="col-check"><input type="checkbox" checked={on} onChange={() => toggle(r.key)} aria-label={fmt(pr.selectRow, { name: r.name })} /></td>
                  {tab === "people" ? (<>
                    <td style={{ maxWidth: 260 }}>
                      <Link className="sdr-who" href={r.href} style={{ textDecoration: "none" }}>
                        <PersonAvatar name={r.name} photoUrl={r.imageUrl} size={32} />
                        <div><span className="sdr-cell-main" dir="auto">{r.name}</span><span className="sdr-cell-sub" dir="auto">{r.title ?? "-"}</span></div>
                      </Link>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      {r.company ? (
                        <div className="sdr-who">
                          <CompanyLogo name={r.company} logoUrl={r.companyLogo} domain={r.companyDomain} size={28} />
                          <div>{r.companyHref ? <Link className="sdr-cell-main" href={r.companyHref} dir="auto">{r.company}</Link> : <span className="sdr-cell-main" dir="auto">{r.company}</span>}{r.companyDomain && <span className="sdr-cell-sub" dir="ltr">{r.companyDomain}</span>}</div>
                        </div>
                      ) : <span className="sdr-cell-sub">-</span>}
                    </td>
                    <td>
                      <span className="sdr-reach">
                        <span className={r.hasEmail ? "on mail" : ""} title={L.reachEmail} aria-label={L.reachEmail}><Mail /></span>
                        {r.linkedinUrl ? <a className="on li" href={r.linkedinUrl} target="_blank" rel="noreferrer" title={L.reachLinkedin} aria-label={L.reachLinkedin}><LinkedInIcon /></a> : <span title={L.reachLinkedin}><LinkedInIcon /></span>}
                        <span className={r.hasPhone ? "on" : ""} title={L.reachPhone} aria-label={L.reachPhone}><Phone /></span>
                      </span>
                    </td>
                    <td style={{ maxWidth: 220 }}>{outreachCell(r)}</td>
                    <td><CrmCell crm={r.crm} /></td>
                  </>) : (<>
                    <td style={{ maxWidth: 300 }}>
                      <Link className="sdr-who" href={r.href} style={{ textDecoration: "none" }}>
                        <CompanyLogo name={r.name} logoUrl={r.imageUrl} domain={r.domain} size={32} />
                        <div><span className="sdr-cell-main" dir="auto">{r.name}</span>{r.domain && <span className="sdr-cell-sub" dir="ltr">{r.domain}</span>}</div>
                      </Link>
                    </td>
                    <td className="num">{n(r.people)}</td>
                    <td style={{ maxWidth: 280 }}>{outreachCell(r)}</td>
                    <td>
                      <span className="sdr-reach">
                        {r.website ? <a className="on" href={r.website} target="_blank" rel="noreferrer" title={L.website} aria-label={L.website}><Globe /></a> : <span><Globe /></span>}
                        {r.linkedinUrl ? <a className="on li" href={r.linkedinUrl} target="_blank" rel="noreferrer" title={L.linkedin} aria-label={L.linkedin}><LinkedInIcon /></a> : <span><LinkedInIcon /></span>}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>{r.updated}</td>
                  </>)}
                  <td className="num">{rowMenu(r)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

      {count > 0 && !picker && (
        <div className="selection-bar" role="region" aria-label={fmt(pr.selected, { count: n(count) })}>
          <span className="selection-count">{fmt(pr.selected, { count: n(count) })}</span>
          <span className="selection-actions">
            <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => setPicker(await openOutreachCampaigns()))}><Send /> {t.ws.outreach.send.button}</button>
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
            {new URLSearchParams(query).get("saved") === "1" ? (
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
        </div>
      )}
      <form ref={exportForm} method="post" action="/prospects/export" hidden>
        <input type="hidden" name="query" value={query} />
        {allMatching ? <input type="hidden" name="all" value="1" /> : [...selected].map((id) => <input key={id} type="hidden" name="id" value={id} />)}
      </form>
      {picker && (
        <SendDialog count={Math.max(count, 1)} campaigns={picker} pending={pending} onClose={() => setPicker(null)}
          onCreate={(input) => { setPicker(null); run(async () => {
            const r = await sendSelectionAsCampaign(target(), input);
            if (!r.ok) { toast(r.error, "error"); return null; }
            // Straight to the campaign: one approval there, then Yolias runs it (D-253).
            router.push(`/outreach/${r.id}`);
            return r.message ?? null;
          }); }}
          onPick={(id) => { setPicker(null); run(async () => {
            const r = await addSelectionToCampaign(id, target());
            if (!r.ok) { toast(r.error, "error"); return null; }
            return r.message ?? null;
          }); }} />
      )}
    </div>
  );
}

/** CRM column: the stage (or how they replied), then what's next. */
function CrmCell({ crm }: { crm: TableRow["crm"] }) {
  const { t, locale } = useI18n();
  const L = t.sdr.leads;
  if (!crm) return <span className="sdr-cell-sub">{L.notContacted}</span>;
  if (crm.doNotContact) return <span className="sdr-badge red">{L.doNotContact}</span>;
  const stage = crm.stage !== "new" ? t.ws.stages[crm.stage as keyof typeof t.ws.stages] : null;
  const label = [stage, crm.kind ? t.sdr.kinds[crm.kind] : null].filter(Boolean).join(" · ");
  const tone = crm.kind === "not_interested" || crm.kind === "stop_request" || crm.stage === "lost" ? "red" : crm.kind === "out_of_office" ? "gray" : crm.kind === "unclassified" || !crm.kind ? (stage ? "green" : "gray") : "green";
  const note = crm.bucket === "needs_action" ? t.sdr.common.actionRequired
    : crm.followUpAt ? fmt(t.sdr.common.nextFollowUp, { date: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { month: "short", day: "numeric" }).format(new Date(crm.followUpAt)) })
    : crm.bucket ? t.sdr.buckets[crm.bucket] : null;
  return (
    <div>
      {label ? <span className={`sdr-badge ${tone}`}>{label}</span> : <span className="sdr-cell-sub">{crm.contacted ? t.prospects.table.outreach.contacted : t.prospects.table.outreach.in_campaign}</span>}
      {note && <span className="sdr-cell-sub">{note}</span>}
    </div>
  );
}

/**
 * Prospects → Send (owner brief 2026-10-19, D-239): name a new email campaign
 * — Yolias creates it and writes each person's email on the campaign page —
 * or add the selection to a campaign that already exists.
 */
function SendDialog({ count, campaigns, pending, onClose, onCreate, onPick }: {
  count: number; campaigns: { id: string; name: string; status: string }[]; pending: boolean;
  onClose: () => void; onCreate: (input: { name: string; channel: "email"; aim: CampaignAim; ctaUrl: string | null }) => void; onPick: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const o = t.ws.outreach;
  const l = o.launch;
  const [aim, setAim] = useState<CampaignAim>("meeting");
  const [cta, setCta] = useState("");
  const [name, setName] = useState(() => fmt(o.send.defaultName, { date: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { day: "numeric", month: "short" }).format(new Date()) }));
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ws-modal send-dialog" role="dialog" aria-modal="true" aria-labelledby="send-title">
        <div className="ws-modal-head">
          <h3 id="send-title">{fmt(o.send.title, { count: formatNumber(count, locale) })}</h3>
          <button className="modal-close-btn" type="button" aria-label={t.common.close} onClick={onClose}><X /></button>
        </div>
        <p className="ws-muted">{o.send.lead}</p>
        <div className="ws-field"><label className="ws-label" htmlFor="send-name">{o.send.name}</label>
          <input id="send-name" className="form-input" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} /></div>
        <div className="ws-field"><label className="ws-label" htmlFor="send-aim">{l.aim}</label>
          <select id="send-aim" className="form-select" value={aim} onChange={(e) => setAim(e.target.value as CampaignAim)}>
            {AIMS.map((a) => <option key={a} value={a}>{l.aims[a]}</option>)}
          </select>
          <span className="cell-sub">{l.aimHints[aim]}</span></div>
        {aimUsesLink(aim) && <div className="ws-field"><label className="ws-label" htmlFor="send-cta">{l.ctaUrl[aim]}</label>
          <input id="send-cta" className="form-input" dir="ltr" type="url" inputMode="url" placeholder={l.ctaPh} value={cta} maxLength={500} onChange={(e) => setCta(e.target.value)} /></div>}
        <div className="ws-actions">
          <button className="btn-primary" type="button" disabled={pending || !name.trim()} onClick={() => onCreate({ name: name.trim(), channel: "email", aim, ctaUrl: aimUsesLink(aim) ? cta.trim() || null : null })}><Send /> {o.send.start}</button>
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
