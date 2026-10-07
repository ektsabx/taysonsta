"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Eye, Mail, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { revealPeople } from "@/app/(app)/prospects/people-actions";
import { LinkedInIcon } from "./ConnectorIcons";
import { AvatarStack, PersonAvatar } from "./Media";
import { ProspectActionButtons } from "./ProspectActions";

export interface GridPerson {
  id: string;
  name: string;
  title: string | null;
  place: string;
  company: string | null;
  companyId: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  emailStatus: string;
  hasEmail: boolean;
  hasPhone: boolean;
  /** Present once revealed. */
  email: string | null;
  phone: string | null;
  revealed: boolean;
  matchScore: number | null;
}

interface Props {
  people: GridPerson[];
  /** Show the company line on each card (results across companies). */
  showCompany?: boolean;
}

// Decision makers as cards (D-147, owner's reference): photo, title, place,
// LinkedIn, whether an email / phone is available, reveal, select → Email,
// LinkedIn or Export CSV for the selection (D-155).
export function PeopleGrid({ people, showCompany = false }: Props) {
  const { t } = useI18n();
  const r = t.results;
  const [rows, setRows] = useState(people);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  // New rows from the server (refresh, filters) replace the local copy.
  const [from, setFrom] = useState(people);
  if (from !== people) {
    setFrom(people);
    setRows(people);
  }

  const all = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const chosen = rows.filter((p) => selected.has(p.id));

  const reveal = (id: string) => start(async () => {
    const res = await revealPeople([id]);
    if (!res.ok) return;
    const c = res.contacts[0];
    setRows((list) => list.map((p) => (p.id === id ? { ...p, revealed: true, email: c?.email ?? null, phone: c?.phone ?? null } : p)));
  });

  if (!rows.length) return null;
  return (
    <>
      <div className="people-grid-head">
        <label className="select-all"><input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((p) => p.id)))} /> {r.selectAll}</label>
      </div>
      <ul className="people-grid">
        {rows.map((p) => (
          <li key={p.id} className={`person-card${selected.has(p.id) ? " selected" : ""}`}>
            <div className="person-card-top">
              <input type="checkbox" aria-label={p.name} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={52} />
              <div className="person-card-id">
                <Link className="person-card-name" href={`/prospects/person/${p.id}`}>{p.name}</Link>
                {p.title && <div className="person-card-title">{p.title}</div>}
                {showCompany && p.company && <div className="person-card-sub">{p.companyId ? <Link href={`/prospects/company/${p.companyId}`}>{p.company}</Link> : p.company}</div>}
                {p.place && <div className="person-card-sub">{p.place}</div>}
                {p.emailStatus === "verified" && <span className="chip-ok">{r.verified}</span>}
              </div>
              {p.linkedinUrl && <a className="person-card-li" href={p.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn"><LinkedInIcon /></a>}
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
                <button className="btn-outline-accent" type="button" disabled={pending || (!p.hasEmail && !p.hasPhone)} onClick={() => reveal(p.id)}><Eye /> {r.reveal}</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {chosen.length > 0 && (
        <div className="selection-bar" role="region" aria-label={fmt(r.selected, { count: chosen.length })}>
          <AvatarStack people={chosen.map((p) => ({ name: p.name, photoUrl: p.photoUrl }))} max={3} size={30} />
          <span>{fmt(r.selected, { count: chosen.length })}</span>
          <span className="selection-actions"><ProspectActionButtons people={chosen} source="results" /></span>
        </div>
      )}
    </>
  );
}
