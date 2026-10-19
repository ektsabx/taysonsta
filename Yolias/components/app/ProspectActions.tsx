"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { exportedPeople } from "@/app/(app)/prospects/message-actions";
import { startCampaignFor } from "@/app/(app)/prospects/actions";
import type { GridPerson } from "./PeopleGrid";

// Prospect actions (D-239): emails are written and sent only in Outreach, from
// the member's connected mailbox. A person or company page starts a campaign
// with them (the campaign page writes the email); a selection can also be
// exported. LinkedIn and other social profiles are links only.

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

/** Creates a campaign with these people / companies and opens it. */
function StartCampaign({ targets, disabled }: { targets: { kind: "person" | "company"; id: string }[]; disabled?: boolean }) {
  const { t, locale } = useI18n();
  const o = t.ws.outreach;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const name = () => fmt(o.send.defaultName, { date: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { day: "numeric", month: "short" }).format(new Date()) });
  return (
    <button className="btn-primary" type="button" disabled={pending || disabled || !targets.length} onClick={() => start(async () => {
      const r = await startCampaignFor(targets, name());
      if (!r.ok) { toast(r.error, "error"); return; }
      router.push(`/outreach/${r.id}`);
    })}><Send /> {o.send.button}</button>
  );
}

/** The buttons for a selection of people (or one person): start a campaign, export CSV. */
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
      <StartCampaign targets={people.map((p) => ({ kind: "person" as const, id: p.id }))} />
      <button className="btn-secondary" type="button" onClick={exportCsv}><Download /> {t.outreach.exportCsv}</button>
      {!onExport && (
        <form ref={exportForm} method="post" action="/prospects/export" hidden>
          <input type="hidden" name="query" value="tab=people" />
          {people.map((p) => <input key={p.id} type="hidden" name="id" value={p.id} />)}
        </form>
      )}
    </>
  );
}

/** One company or local business: start a campaign to its business email (shown when it has one). */
export function CompanyActionButtons({ company }: { company: MessageRecipient }) {
  if (!company.can.email) return null;
  return <StartCampaign targets={[{ kind: company.kind, id: company.id }]} />;
}
