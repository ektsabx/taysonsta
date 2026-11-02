import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberMailboxes } from "@/lib/mailbox";
import { RANGE_PRESETS, rangeBounds, type RangePreset } from "@/lib/campaigns/metrics";
import { campaignTable } from "@/services/campaign-table";
import { CampaignsManager } from "@/components/app/campaigns/CampaignsManager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).camp.manager.title} | Yolias` };
}

// Campaigns (owner, 2026-10-31, D-272, D-273): the ads manager, with
// Campaigns / Audiences / Messages. The date range lives in the URL
// (?range=7d, or ?range=custom&from=&to=) and decides every count; the rest
// of the table (level, filters, columns) is in the page. No saved views (D-274).
export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const range = (RANGE_PRESETS as string[]).includes(one("range")) ? (one("range") as RangePreset) : "lifetime";
  const from = one("from"), to = one("to");
  const [t, lines, boxes, { data: memberRows }] = await Promise.all([
    getDictionary(),
    campaignTable(ws, rangeBounds(range, new Date(), { from, to }), { includeArchived: true }),
    memberMailboxes(ws, session.userId),
    createAdminClient().from("profiles").select("id, full_name, email").eq("workspace_id", ws),
  ]);
  const members = (memberRows ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || "" }));
  const hasMailbox = boxes.some((b) => b.status === "connected");
  return (
    <div className="sdr-page cm-page">
      <header className="sdr-head"><div><h2>{t.ag.manager.title}</h2><p>{t.ag.manager.subtitle}</p></div></header>
      {!hasMailbox && <div className="ws-note"><Info /><span><strong>{t.ws.common.notConnectedTitle}.</strong> {t.ws.common.mailboxNotConnected}</span></div>}
      <CampaignsManager lines={lines} members={members} range={range} from={from} to={to} refreshedAt={new Date().toISOString()} />
    </div>
  );
}
