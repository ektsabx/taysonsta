import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import type { CommunicationItem } from "@/services/bos/communications";
import { EmptyState } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";

export const communicationKindLabels: Record<string, string> = {
  call: "مكالمة",
  email: "بريد (مسجل)",
  email_message: "بريد إلكتروني",
  whatsapp: "واتساب",
  linkedin: "لينكدإن",
  meeting: "اجتماع",
  client_communication: "تواصل مع العميل",
  note: "ملاحظة",
};

const icons: Record<string, string> = { call: "☎", email: "✉", email_message: "✉", whatsapp: "WA", linkedin: "in", meeting: "◷", client_communication: "💬", note: "✎" };
const directionLabels: Record<string, string> = { inbound: "وارد", outbound: "صادر", internal: "داخلي" };

// Shared renderer for the unified communication feed (§28), used on the
// global page and inside Account / Contact / Lead / Deal tabs.
export function CommunicationList({
  items,
  names,
  labels = {},
}: {
  items: CommunicationItem[];
  names: Record<string, string>;
  labels?: { clients?: Record<string, string>; contacts?: Record<string, string> };
}) {
  if (!items.length) return <EmptyState title="لا يوجد تواصل مسجل" description="سجّل مكالمة أو رسالة أو اجتماعاً ليظهر هنا." />;
  return (
    <ul className="bos-comm-list">
      {items.map((i) => {
        const related: { label: string; href: string }[] = [];
        if (i.clientId && labels.clients?.[i.clientId]) related.push({ label: labels.clients[i.clientId], href: `/admin/clients/${i.clientId}` });
        if (i.contactId && labels.contacts?.[i.contactId]) related.push({ label: labels.contacts[i.contactId], href: `/admin/contacts/${i.contactId}` });
        if (i.dealId) related.push({ label: "الصفقة", href: `/admin/sales/deals/${i.dealId}` });
        if (i.leadId) related.push({ label: "العميل المحتمل", href: `/admin/sales/leads/${i.leadId}` });
        if (i.projectId) related.push({ label: "المشروع", href: `/admin/projects/${i.projectId}` });
        return (
          <li key={`${i.source}-${i.id}`} className="bos-comm-item">
            <span className={`bos-comm-icon ${i.direction ?? ""}`} aria-hidden><Tx>{icons[i.kind] ?? "•"}</Tx></span>
            <div>
              <div className="bos-comm-title">{i.href ? <Link href={i.href}><Tx>{i.title}</Tx></Link> : i.title}</div>
              {i.body ? <div className="bos-comm-body">{i.body.length > 400 ? `${i.body.slice(0, 400)}…` : i.body}</div> : null}
              <div className="bos-comm-meta">
                <span><Tx>{communicationKindLabels[i.kind] ?? i.kind}</Tx></span>
                {i.direction ? <span><Tx>{directionLabels[i.direction] ?? i.direction}</Tx></span> : null}
                {i.userId && names[i.userId] ? <span><Tx>{names[i.userId]}</Tx></span> : null}
                {related.map((r) => <Link key={r.href} href={r.href} className="bos-link"><Tx>{r.label}</Tx></Link>)}
              </div>
            </div>
            <span className="bos-comm-time">{formatDateTime(i.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
