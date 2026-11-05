"use client";

import { useRef } from "react";
import { Download } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { exportedPeople } from "@/app/(app)/leads/message-actions";
import type { GridPerson } from "./PeopleGrid";

// Prospect actions (D-239, D-273): people reach a campaign through its
// audiences (Audiences → custom audience), never by hand from here; a
// selection can be exported. LinkedIn and other social profiles are links only.

/** A company or local business a campaign can be started for. */
export interface MessageRecipient {
  kind: "person" | "company";
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  photoUrl: string | null;
  logo?: { logoUrl: string | null; domain: string | null };
  can: { email: boolean };
}

/** The buttons for a selection of people (or one person): export CSV. */
export function ProspectActionButtons({ people, source, onExport }: { people: GridPerson[]; source: "results" | "prospects"; onExport?: () => void }) {
  const { t } = useI18n();
  const exportForm = useRef<HTMLFormElement>(null);
  const exportCsv = () => {
    if (onExport) onExport();
    else exportForm.current?.requestSubmit();
    void exportedPeople(people.length, source);
  };
  return (
    <>
      <button className="btn-secondary" type="button" onClick={exportCsv}><Download /> {t.outreach.exportCsv}</button>
      {!onExport && (
        <form ref={exportForm} method="post" action="/leads/export" hidden>
          <input type="hidden" name="query" value="tab=people" />
          {people.map((p) => <input key={p.id} type="hidden" name="id" value={p.id} />)}
        </form>
      )}
    </>
  );
}

/** One company or local business: nothing to start by hand (D-273: campaigns find and write to people). */
export function CompanyActionButtons(_: { company: MessageRecipient }) {
  void _;
  return null;
}
