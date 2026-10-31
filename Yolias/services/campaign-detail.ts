import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAutoReplyRow } from "@/lib/outreach/auto-reply";
import { inRange } from "@/lib/campaigns/metrics";

// One campaign's detail tabs (owner, 2026-10-31, D-272): performance broken
// down by day, audience group, first-email variant, sequence step, industry,
// country and job title; its messages; its conversations; its meetings.
// Counted from real rows, each person once per count. Called after
// requireViewer with the session's workspace (admin client, filtered by it).

const POSITIVE = new Set(["interested", "meeting_request"]);
export type Dimension = "day" | "group" | "variant" | "step" | "industry" | "country" | "title";
export interface BreakRow { key: string; contacted: number; sent: number; bounced: number; replies: number; interested: number; meetings: number }

type Msg = { id: string; lead_id: string | null; enrollment_id: string | null; direction: string; status: string; delivery_status: string | null; sent_at: string | null; received_at: string | null; created_at: string; analysis: unknown; variant: string | null; step_position: number | null; subject: string; body: string; to_email: string | null };

export async function campaignDetail(workspaceId: string, campaignId: string, range: { from: string | null; to: string | null }) {
  const db = createAdminClient();
  const [{ data: msgsRaw }, { data: enr }, { data: groups }, { data: meetings }] = await Promise.all([
    db.from("outreach_messages").select("id, lead_id, enrollment_id, direction, status, delivery_status, sent_at, received_at, created_at, analysis, variant, step_position, subject, body, to_email")
      .eq("workspace_id", workspaceId).eq("outreach_campaign_id", campaignId).order("created_at", { ascending: false }).limit(5000),
    db.from("outreach_enrollments").select("id, lead_id, audience_group_id, status, current_step, lead:sales_leads(name, company_name, email, stage, prospect:prospects(title, country), company:companies(industry, country))").eq("campaign_id", campaignId).limit(5000),
    db.from("audience_groups").select("id, name").eq("campaign_id", campaignId),
    db.from("sales_meetings").select("id, lead_id, title, starts_at, status, qualified, source, lead:sales_leads(name, company_name)").eq("workspace_id", workspaceId).eq("campaign_id", campaignId).order("starts_at", { ascending: false }).limit(500),
  ]);
  const msgs = (msgsRaw ?? []) as Msg[];
  type Lead = { name: string; company_name: string | null; email: string | null; stage: string; prospect: { title: string | null; country: string | null } | null; company: { industry: string | null; country: string | null } | null };
  const leadOf = new Map((enr ?? []).map((e) => [e.lead_id, e.lead as unknown as Lead | null]));
  const groupOf = new Map((enr ?? []).map((e) => [e.lead_id, e.audience_group_id]));
  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));
  const firstVariant = new Map<string, string>();
  for (const m of msgs) if (m.direction === "outbound" && m.step_position === 1 && m.variant && m.lead_id) firstVariant.set(m.lead_id, m.variant);

  const keyFor = (dim: Dimension, m: Msg): string | null => {
    const lead = m.lead_id ? leadOf.get(m.lead_id) : null;
    switch (dim) {
      case "day": return (m.direction === "outbound" ? m.sent_at : m.received_at ?? m.created_at)?.slice(0, 10) ?? null;
      case "group": return m.lead_id ? groupName.get(groupOf.get(m.lead_id) ?? "") ?? "–" : null;
      case "variant": return m.lead_id ? (firstVariant.get(m.lead_id)?.toUpperCase() ?? "–") : null;
      case "step": return m.direction === "outbound" ? String(m.step_position ?? "–") : null;
      case "industry": return lead?.company?.industry ?? "–";
      case "country": return (lead?.prospect?.country ?? lead?.company?.country ?? "–").toUpperCase();
      case "title": return lead?.prospect?.title ?? "–";
    }
  };
  const breakdown = (dim: Dimension): BreakRow[] => {
    const rows = new Map<string, BreakRow & { c: Set<string>; r: Set<string>; i: Set<string> }>();
    const row = (k: string) => { if (!rows.has(k)) rows.set(k, { key: k, contacted: 0, sent: 0, bounced: 0, replies: 0, interested: 0, meetings: 0, c: new Set(), r: new Set(), i: new Set() }); return rows.get(k)!; };
    for (const m of msgs) {
      if (!m.lead_id) continue;
      if (m.direction === "outbound" && m.status === "sent" && inRange(m.sent_at, range)) {
        const k = keyFor(dim, m); if (!k) continue;
        const x = row(k); x.sent++; if (m.delivery_status === "bounced") x.bounced++; x.c.add(m.lead_id);
      } else if (m.direction === "inbound" && inRange(m.received_at ?? m.created_at, range) && !isAutoReplyRow(m)) {
        // Replies count against the step / variant that reached the person (their first email) for those two dimensions.
        const k = dim === "step" ? "1" : keyFor(dim, m); if (!k) continue;
        const x = row(k); x.r.add(m.lead_id);
        if (POSITIVE.has((m.analysis as { kind?: string } | null)?.kind ?? "")) x.i.add(m.lead_id);
      }
    }
    for (const mt of meetings ?? []) {
      if (mt.status === "canceled" || !inRange(mt.starts_at, range)) continue;
      const fake = { lead_id: mt.lead_id, direction: "inbound", received_at: mt.starts_at, created_at: mt.starts_at } as Msg;
      const k = dim === "step" ? "1" : keyFor(dim, fake); if (k) row(k).meetings++;
    }
    return [...rows.values()].map(({ c, r, i, ...x }) => ({ ...x, contacted: c.size, replies: r.size, interested: i.size }))
      .sort((a, b) => (dim === "day" || dim === "step" ? a.key.localeCompare(b.key) : b.contacted - a.contacted)).slice(0, dim === "day" ? 400 : 50);
  };

  const messages = msgs.filter((m) => m.direction === "outbound").slice(0, 200).map((m) => ({
    id: m.id, leadId: m.lead_id, lead: m.lead_id ? leadOf.get(m.lead_id)?.name ?? "" : "", subject: m.subject, preview: m.body.replace(/\s+/g, " ").slice(0, 140),
    step: m.step_position, variant: m.variant, status: m.status, deliveryStatus: m.delivery_status, at: m.sent_at ?? m.created_at,
  }));
  const latestIn = new Map<string, Msg>();
  for (const m of msgs) if (m.direction === "inbound" && m.lead_id && !latestIn.has(m.lead_id)) latestIn.set(m.lead_id, m);
  const conversations = [...latestIn.values()].map((m) => ({
    leadId: m.lead_id!, lead: leadOf.get(m.lead_id!)?.name ?? "", company: leadOf.get(m.lead_id!)?.company_name ?? null, group: groupName.get(groupOf.get(m.lead_id!) ?? "") ?? null,
    kind: (m.analysis as { kind?: string } | null)?.kind ?? null, preview: m.body.replace(/\s+/g, " ").slice(0, 140), at: m.received_at ?? m.created_at,
  }));
  const people = (enr ?? []).map((e) => {
    const l = e.lead as unknown as Lead | null;
    return { enrollmentId: e.id, leadId: e.lead_id, name: l?.name ?? "", company: l?.company_name ?? null, email: l?.email ?? null, title: l?.prospect?.title ?? null, country: l?.prospect?.country ?? l?.company?.country ?? null, stage: l?.stage ?? "new", status: e.status, step: e.current_step, group: groupName.get(e.audience_group_id ?? "") ?? null };
  });
  const meetingRows = (meetings ?? []).map((m) => ({ id: m.id, leadId: m.lead_id, title: m.title, at: m.starts_at, status: m.status, qualified: m.qualified, source: m.source, lead: (m.lead as unknown as { name: string; company_name: string | null } | null)?.name ?? "" }));
  const dims: Dimension[] = ["day", "group", "variant", "step", "industry", "country", "title"];
  return { breakdowns: Object.fromEntries(dims.map((d) => [d, breakdown(d)])) as Record<Dimension, BreakRow[]>, messages, conversations, people, meetings: meetingRows };
}
export type CampaignDetailData = Awaited<ReturnType<typeof campaignDetail>>;
