"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { revealContacts } from "@/app/(app)/prospects/actions";

// Small pieces of the Prospects workspace used on several pages: a person's
// masked contact (reveal) and a company's decision-maker matching state.

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
