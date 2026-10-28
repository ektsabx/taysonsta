import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getLead } from "@/services/crm";
import { getLocale } from "@/lib/i18n/server";
import { QuoteSheet } from "@/components/app/crm/QuoteSheet";

export const metadata: Metadata = { title: "Quote | Yolias" };

// A simple quote for a deal (owner, 2026-10-29): your company, the client, the
// lines and the total, filled from the deal; the member edits it on the page and
// saves it as PDF with the browser's print (no PDF service, nothing stored).
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getLead(session.workspace.id, id);
  if (!detail) notFound();
  const w = session.workspace;
  return (
    <QuoteSheet
      locale={await getLocale()}
      from={{ name: w.name ?? "", website: w.website ?? "", email: session.email }}
      to={{ name: detail.lead.company_name || detail.lead.name, contact: detail.lead.company_name ? detail.lead.name : "", email: detail.lead.email ?? "" }}
      amount={detail.lead.deal_value ?? 0}
      currency={detail.lead.deal_currency}
      offering={w.offering ?? ""}
      leadId={id}
    />
  );
}
