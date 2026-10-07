"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { AvatarStack } from "./Media";
import { PersonCard } from "./Cards";
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
  /** WhatsApp number (or a phone to try on WhatsApp) is known. */
  hasWhatsapp: boolean;
  facebookUrl: string | null;
  instagramUrl: string | null;
  bookmarked: boolean;
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

  if (!rows.length) return null;
  return (
    <>
      <div className="people-grid-head">
        <label className="select-all"><input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((p) => p.id)))} /> {r.selectAll}</label>
      </div>
      <ul className="people-grid">
        {rows.map((p) => (
          <PersonCard key={p.id} person={p} showCompany={showCompany} selected={selected.has(p.id)} onToggle={() => toggle(p.id)}
            onRevealed={(next) => setRows((list) => list.map((x) => (x.id === next.id ? next : x)))} />
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
