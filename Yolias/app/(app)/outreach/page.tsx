import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberMailboxes } from "@/lib/mailbox";
import { RANGE_PRESETS, rangeBounds, type RangePreset } from "@/lib/campaigns/metrics";
import { campaignTable } from "@/services/campaign-table";
import { CampaignsManager } from "@/components/app/campaigns/CampaignsManager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).camp.manager.title} | Yolias` };
}

// Campaigns (owner, 2026-10-31, D-272): the ads manager. The date range lives
// in the URL (?range=7d, or ?range=custom&from=&to=) and decides every count;
// the rest of the table (filters, columns, breakdown, views) is in the page.
export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const range = (RANGE_PRESETS as string[]).includes(one("range")) ? (one("range") as RangePreset) : "lifetime";
  const from = one("from"), to = one("to");
  const db = await createClient();
  const [t, lines, boxes, { data: memberRows }, { data: views }] = await Promise.all([
    getDictionary(),
    campaignTable(ws, rangeBounds(range, new Date(), { from, to }), { includeArchived: true }),
    memberMailboxes(ws, session.userId),
    createAdminClient().from("profiles").select("id, full_name, email").eq("workspace_id", ws),
    db.from("saved_views").select("id, name, config").eq("user_id", session.userId).eq("workspace_id", ws).eq("scope", "campaigns").order("created_at"),
  ]);
  const members = (memberRows ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || "" }));
  const hasMailbox = boxes.some((b) => b.status === "connected");
  return (
    <div className="sdr-page cm-page">
      <header className="sdr-head"><div><h2>{t.camp.manager.title}</h2><p>{t.camp.manager.subtitle}</p></div></header>
      {!hasMailbox && <div className="ws-note"><Info /><span><strong>{t.ws.common.notConnectedTitle}.</strong> {t.ws.common.mailboxNotConnected}</span></div>}
      <CampaignsManager lines={lines} members={members} views={(views ?? []) as never} range={range} from={from} to={to} refreshedAt={new Date().toISOString()} />
    </div>
  );
}
