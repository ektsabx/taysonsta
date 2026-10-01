"use client";

import { useI18n } from "@/lib/i18n/client";
import type { ProspectRow } from "@/types/database";

// Contact channels Yolias found for a prospect. Email is labelled by its
// verification state; nothing is shown for channels that weren't found.
export function ChannelBadges({ prospect, directWhatsApp = false }: { prospect: Pick<ProspectRow, "email" | "email_status" | "whatsapp" | "linkedin_url">; directWhatsApp?: boolean }) {
  const { t } = useI18n();
  const c = t.channels;
  const { email, email_status, whatsapp, linkedin_url } = prospect;
  if (!email && !whatsapp && !linkedin_url) return <span className="cell-sub">—</span>;
  return (
    <div className="channel-badges">
      {email && email_status !== "invalid" && (
        <a className="badge-chan chan-email" href={`mailto:${email}`} title={`${email} · ${email_status === "verified" ? c.verified : c.notVerified}`}>
          {c.email}{email_status === "verified" ? " ✓" : ""}
        </a>
      )}
      {whatsapp && (
        <a className="badge-chan chan-wa" href={`https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">
          {directWhatsApp ? c.directWhatsapp : c.whatsapp}
        </a>
      )}
      {linkedin_url && (
        <a className="badge-chan chan-in" href={linkedin_url} target="_blank" rel="noreferrer">{c.linkedin}</a>
      )}
    </div>
  );
}
