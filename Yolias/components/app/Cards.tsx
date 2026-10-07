"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, Eye, Mail, Phone, Star, UsersRound } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { revealPeople } from "@/app/(app)/prospects/people-actions";
import { LinkedInIcon } from "./ConnectorIcons";
import { AvatarStack, CompanyLogo, PersonAvatar } from "./Media";
import { CollectButton, SaveButton } from "./ResultActions";
import type { GridPerson } from "./PeopleGrid";

// The one card design for people, companies and local businesses (owner's
// reference, 2026-10-07): search results, every Prospects tab and Saved use
// these, so the product looks the same everywhere.

/** A company or local business as a card. */
export interface CardCompany {
  id: string;
  kind: "company" | "local_business";
  name: string;
  domain: string | null;
  website: string | null;
  logoUrl: string | null;
  /** "Industry · City · 51–200" (or category for a local business). */
  meta: string;
  rating: number | null;
  reviews: number | null;
  bookmarked: boolean;
  people: { name: string; photoUrl: string | null }[];
  peopleStatus: string | null;
  peopleRequested: boolean;
  /** A source for decision makers is connected: collecting can be offered. */
  canCollect: boolean;
}

function Select({ label, checked, onToggle }: { label: string; checked: boolean; onToggle?: () => void }) {
  return onToggle ? <input type="checkbox" aria-label={label} checked={checked} onChange={onToggle} /> : null;
}

/** A person: photo, title, company, place, LinkedIn, save, email / phone (masked until revealed), reveal. */
export function PersonCard({ person, showCompany = true, selected = false, onToggle, onRevealed }: {
  person: GridPerson; showCompany?: boolean; selected?: boolean; onToggle?: () => void; onRevealed?: (p: GridPerson) => void;
}) {
  const { t } = useI18n();
  const r = t.results;
  const [p, setP] = useState(person);
  const [from, setFrom] = useState(person);
  if (from !== person) {
    setFrom(person);
    setP(person);
  }
  const [pending, start] = useTransition();
  const reveal = () => start(async () => {
    const res = await revealPeople([p.id]);
    if (!res.ok) return;
    const c = res.contacts[0];
    const next = { ...p, revealed: true, email: c?.email ?? null, phone: c?.phone ?? null };
    setP(next);
    onRevealed?.(next);
  });
  return (
    <li className={`person-card${selected ? " selected" : ""}`}>
      <div className="person-card-top">
        <Select label={p.name} checked={selected} onToggle={onToggle} />
        <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={52} />
        <div className="person-card-id">
          <Link className="person-card-name" href={`/prospects/person/${p.id}`}>{p.name}</Link>
          {p.title && <div className="person-card-title">{p.title}</div>}
          {showCompany && p.company && <div className="person-card-sub">{p.companyId ? <Link href={`/prospects/company/${p.companyId}`}>{p.company}</Link> : p.company}</div>}
          {p.place && <div className="person-card-sub">{p.place}</div>}
          {p.emailStatus === "verified" && <span className="chip-ok">{r.verified}</span>}
        </div>
        <span className="person-card-tools">
          {p.linkedinUrl && <a className="person-card-li" href={p.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn"><LinkedInIcon /></a>}
          <SaveButton kind="person" id={p.id} saved={p.bookmarked} compact />
        </span>
      </div>
      <dl className="person-card-contact">
        <dt><Mail /> {r.email}</dt>
        <dd dir={p.revealed && p.email ? "ltr" : undefined}>{p.revealed ? (p.email ?? <span className="muted">{r.notFound}</span>) : p.hasEmail ? <span className="ok">{r.available}</span> : <span className="muted">{r.notFound}</span>}</dd>
        <dt><Phone /> {r.phone}</dt>
        <dd dir={p.revealed && p.phone ? "ltr" : undefined}>{p.revealed ? (p.phone ?? <span className="muted">{r.notFound}</span>) : p.hasPhone ? <span className="ok">{r.available}</span> : <span className="muted">{r.notFound}</span>}</dd>
      </dl>
      <div className="person-card-actions">
        <Link className="btn-secondary" href={`/prospects/person/${p.id}`}>{r.viewProfile} <ExternalLink /></Link>
        {p.revealed ? (
          <span className="revealed-pill"><CheckCircle2 /> {r.revealed}</span>
        ) : (
          <button className="btn-outline-accent" type="button" disabled={pending || (!p.hasEmail && !p.hasPhone)} onClick={reveal}><Eye /> {r.reveal}</button>
        )}
      </div>
    </li>
  );
}

/** A company or local business: logo, site, save, what it is, its decision makers, open / collect. */
export function CompanyCard({ company: c, selected = false, onToggle }: { company: CardCompany; selected?: boolean; onToggle?: () => void }) {
  const { t, locale } = useI18n();
  const r = t.results;
  const n = (v: number) => formatNumber(v, locale);
  const site = c.domain ?? c.website;
  return (
    <li className={`company-card${selected ? " selected" : ""}`}>
      <div className="company-card-top">
        <Select label={c.name} checked={selected} onToggle={onToggle} />
        <CompanyLogo name={c.name} logoUrl={c.logoUrl} domain={c.domain} size={44} />
        <div className="company-card-id">
          <Link className="company-card-name" href={`/prospects/company/${c.id}`}>{c.name}</Link>
          {site && <a className="company-card-site" href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noreferrer" dir="ltr">{site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} <ExternalLink /></a>}
        </div>
        <SaveButton kind="company" id={c.id} saved={c.bookmarked} compact />
      </div>
      <div className="company-card-meta">
        {c.meta}
        {c.rating != null && <span className="company-card-rating"><Star /> {c.rating}{c.reviews != null ? ` (${n(c.reviews)})` : ""}</span>}
      </div>
      <div className="company-card-people">
        <span className="company-card-people-icon"><UsersRound /></span>
        {c.people.length ? (
          <div>
            <strong>{fmt(r.dmCount, { count: n(c.people.length) })}</strong>
            <AvatarStack people={c.people} max={4} size={24} />
          </div>
        ) : (
          <div>
            <strong>{c.canCollect && c.peopleStatus !== "done" ? r.notCollected : r.noPeopleFound}</strong>
            {c.canCollect && c.peopleStatus !== "done" && <span className="cell-sub">{r.notCollectedSub}</span>}
          </div>
        )}
      </div>
      <div className="company-card-actions">
        <Link className="btn-secondary" href={`/prospects/company/${c.id}`}>{r.viewCompany}</Link>
        {c.people.length ? (
          <Link className="btn-outline-accent" href={`/prospects/company/${c.id}#decision-makers`}>{r.viewDecisionMakers} <ArrowRight className="flip-rtl" /></Link>
        ) : !c.canCollect || c.peopleStatus === "done" ? null : (
          <CollectButton id={c.id} running={c.peopleStatus === "running" || c.peopleStatus === "queued"} />
        )}
      </div>
    </li>
  );
}
