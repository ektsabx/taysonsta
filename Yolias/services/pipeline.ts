import "server-only";
import { createClient } from "@/lib/supabase/server";
import { REPLY_KINDS } from "@/lib/automations/schema";
import type { LeadStage } from "@/types/acquisition";

// Where each lead stands (D-256), after AgentSDR's CRM pipeline. One reading
// shared by the CRM pipeline, the Inbox details panel and the Prospects CRM
// column, so the same lead shows the same status everywhere:
//   needs action   their reply is the last word (not an out-of-office), or a reply draft waits for you
//   waiting        you wrote last and a follow-up is scheduled, or you answered in the last WAIT_DAYS
//   exhausted      you wrote last, nothing is scheduled and they stayed silent WAIT_DAYS or more
// "Potential" leaves out leads who said no (not interested, asked to stop, lost, do not contact).
// Read with the member's client (RLS keeps it to their workspace).

export type ReplyKind = (typeof REPLY_KINDS)[number] | "unclassified";
export type Bucket = "needs_action" | "waiting" | "exhausted";
export const WAIT_DAYS = 7;
const DAY = 86_400_000;

export interface LeadStatus {
  leadId: string;
  name: string;
  companyName: string | null;
  companyId: string | null;
  prospectId: string | null;
  domain: string | null;
  logoUrl: string | null;
  email: string | null;
  stage: LeadStage;
  doNotContact: boolean;
  lastActivityAt: string;
  /** Their latest reply and how Yolias read it. */
  lastInbound: { id: string; body: string; subject: string; at: string; kind: ReplyKind; summary: string | null; suggestedReply: string | null } | null;
  lastOutbound: { at: string; subject: string; from: string | null } | null;
  /** A reply waiting for the member: an unsent draft written after their latest message. */
  draft: { id: string; subject: string; body: string } | null;
  /** The next campaign email, when one is scheduled. */
  followUp: { at: string; campaign: string } | null;
  /** Every follow-up of a campaign went out (sequence done). */
  sequenceDone: boolean;
  campaigns: { id: string; name: string }[];
  messages: number;
  bucket: Bucket | null;
  potential: boolean;
}

const NEGATIVE = new Set<ReplyKind>(["not_interested", "stop_request"]);

/** Statuses for the given leads (Prospects, Inbox), or every lead with a conversation (the pipeline). */
export async function leadStatuses(workspaceId: string, opts: { leadIds?: string[]; limit?: number } = {}): Promise<LeadStatus[]> {
  const db = await createClient();
  let ids = opts.leadIds;
  if (!ids) {
    // The pipeline: leads who replied, and leads moved on in the CRM by hand.
    const [{ data: replied }, { data: moved }] = await Promise.all([
      db.from("outreach_messages").select("lead_id").eq("workspace_id", workspaceId).eq("direction", "inbound").not("lead_id", "is", null).order("created_at", { ascending: false }).limit(5000),
      db.from("sales_leads").select("id").eq("workspace_id", workspaceId).neq("stage", "new").limit(2000),
    ]);
    ids = [...new Set([...(replied ?? []).map((m) => m.lead_id!), ...(moved ?? []).map((l) => l.id)])].slice(0, opts.limit ?? 1000);
  }
  if (!ids.length) return [];
  const chunks = <T,>(fn: (part: string[]) => PromiseLike<{ data: T[] | null }>) =>
    Promise.all(Array.from({ length: Math.ceil(ids!.length / 200) }, (_, i) => fn(ids!.slice(i * 200, i * 200 + 200)))).then((r) => r.flatMap((x) => x.data ?? []));
  type LeadRow = { id: string; name: string; company_name: string | null; company_id: string | null; prospect_id: string | null; email: string | null; stage: LeadStage; do_not_contact: boolean; last_activity_at: string; company: { domain: string | null; logo_url: string | null } | null };
  type Msg = { id: string; lead_id: string; direction: "inbound" | "outbound"; status: string; subject: string; body: string; analysis: unknown; sent_at: string | null; received_at: string | null; created_at: string; from_address: string | null; enrollment_id: string | null; step_position: number | null };
  type Enr = { lead_id: string; status: string; next_step_at: string | null; stop_reason: string | null; campaign: { id: string; name: string } | null };
  const [leads, msgs, enrs] = await Promise.all([
    chunks<LeadRow>((part) => db.from("sales_leads").select("id, name, company_name, company_id, prospect_id, email, stage, do_not_contact, last_activity_at, company:companies(domain, logo_url)").eq("workspace_id", workspaceId).in("id", part) as never),
    chunks<Msg>((part) => db.from("outreach_messages").select("id, lead_id, direction, status, subject, body, analysis, sent_at, received_at, created_at, from_address, enrollment_id, step_position")
      .eq("workspace_id", workspaceId).in("lead_id", part).in("status", ["sent", "received", "draft", "approved"]).order("created_at", { ascending: false }).limit(4000) as never),
    chunks<Enr>((part) => db.from("outreach_enrollments").select("lead_id, status, next_step_at, stop_reason, campaign:outreach_campaigns(id, name)").eq("workspace_id", workspaceId).in("lead_id", part) as never),
  ]);
  const byLead = <T extends { lead_id: string }>(rows: T[]) => rows.reduce((m, r) => m.set(r.lead_id, [...(m.get(r.lead_id) ?? []), r]), new Map<string, T[]>());
  const msgBy = byLead(msgs), enrBy = byLead(enrs);
  const now = Date.now();
  return leads.map((l) => {
    const ms = msgBy.get(l.id) ?? [];
    const at = (m: Msg) => m.received_at ?? m.sent_at ?? m.created_at;
    const done = ms.filter((m) => m.status === "sent" || m.status === "received").sort((a, b) => Date.parse(at(b)) - Date.parse(at(a)));
    const inbound = done.find((m) => m.direction === "inbound") ?? null;
    const outbound = done.find((m) => m.direction === "outbound") ?? null;
    const analysis = (inbound?.analysis ?? null) as { kind?: string; summary?: string; suggested_reply?: string | null } | null;
    const kind: ReplyKind = analysis?.kind && (REPLY_KINDS as readonly string[]).includes(analysis.kind) ? (analysis.kind as ReplyKind) : "unclassified";
    // A draft the member still has to send: not a campaign step, written after their latest reply.
    const draftRow = inbound ? ms.find((m) => m.direction === "outbound" && (m.status === "draft" || m.status === "approved") && !m.step_position && Date.parse(m.created_at) >= Date.parse(at(inbound))) ?? null : null;
    const es = enrBy.get(l.id) ?? [];
    const next = es.filter((e) => e.status === "active" && e.next_step_at).sort((a, b) => Date.parse(a.next_step_at!) - Date.parse(b.next_step_at!))[0] ?? null;
    const theirs = inbound && (!outbound || Date.parse(at(inbound)) > Date.parse(at(outbound)));
    const potential = !l.do_not_contact && l.stage !== "lost" && !NEGATIVE.has(kind);
    let bucket: Bucket | null = null;
    if (done.length || l.stage !== "new") {
      // An out-of-office reply waits for them to be back (AgentSDR: "Bump after out-of-office").
      if ((theirs && kind !== "out_of_office") || draftRow) bucket = "needs_action";
      else if (theirs) bucket = "waiting";
      else if (next || (outbound && now - Date.parse(at(outbound)) < WAIT_DAYS * DAY)) bucket = "waiting";
      else if (outbound) bucket = "exhausted";
      else bucket = "needs_action"; // moved to the CRM by hand, never written to yet
    }
    return {
      leadId: l.id, name: l.name, companyName: l.company_name, companyId: l.company_id, prospectId: l.prospect_id, domain: l.company?.domain ?? null, logoUrl: l.company?.logo_url ?? null,
      email: l.email, stage: l.stage, doNotContact: l.do_not_contact, lastActivityAt: l.last_activity_at,
      lastInbound: inbound ? { id: inbound.id, body: inbound.body, subject: inbound.subject, at: at(inbound), kind, summary: analysis?.summary ?? null, suggestedReply: analysis?.suggested_reply ?? null } : null,
      lastOutbound: outbound ? { at: at(outbound), subject: outbound.subject, from: outbound.from_address } : null,
      draft: draftRow ? { id: draftRow.id, subject: draftRow.subject, body: draftRow.body } : null,
      followUp: next ? { at: next.next_step_at!, campaign: next.campaign?.name ?? "" } : null,
      sequenceDone: es.some((e) => e.status === "completed" && e.stop_reason === "sequence_done"),
      campaigns: [...new Map(es.filter((e) => e.campaign).map((e) => [e.campaign!.id, e.campaign!])).values()],
      messages: done.length,
      bucket, potential,
    };
  });
}

/** Statuses keyed by the prospect or company a lead came from (the Prospects table). */
export async function statusesForProspects(workspaceId: string, items: { id: string; kind: "person" | "company" }[]): Promise<Map<string, LeadStatus>> {
  const out = new Map<string, LeadStatus>();
  if (!items.length) return out;
  const db = await createClient();
  const people = items.filter((i) => i.kind === "person").map((i) => i.id);
  const companies = items.filter((i) => i.kind === "company").map((i) => i.id);
  const [byPerson, byCompany] = await Promise.all([
    people.length ? db.from("sales_leads").select("id").eq("workspace_id", workspaceId).in("prospect_id", people) : Promise.resolve({ data: [] as { id: string }[] }),
    companies.length ? db.from("sales_leads").select("id").eq("workspace_id", workspaceId).is("prospect_id", null).in("company_id", companies) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const ids = [...(byPerson.data ?? []), ...(byCompany.data ?? [])].map((l) => l.id);
  for (const s of await leadStatuses(workspaceId, { leadIds: ids })) out.set(s.prospectId ?? s.companyId ?? s.leadId, s);
  return out;
}

/** For the Companies tab: saved people per company, the campaigns its leads are in, and when it was last updated. */
export async function companyOutreach(workspaceId: string, companyIds: string[]): Promise<Map<string, { people: number; campaigns: { id: string; name: string }[]; updatedAt: string | null; website: string | null; linkedinUrl: string | null }>> {
  const out = new Map<string, { people: number; campaigns: { id: string; name: string }[]; updatedAt: string | null; website: string | null; linkedinUrl: string | null }>();
  if (!companyIds.length) return out;
  const db = await createClient();
  const [{ data: rows }, { data: people }, { data: leads }] = await Promise.all([
    db.from("companies").select("id, last_updated, website, domain, linkedin_url").eq("workspace_id", workspaceId).in("id", companyIds),
    db.from("prospects").select("company_id").eq("workspace_id", workspaceId).in("company_id", companyIds).not("saved_at", "is", null).limit(10_000),
    db.from("sales_leads").select("id, company_id").eq("workspace_id", workspaceId).in("company_id", companyIds).limit(10_000),
  ]);
  const leadIds = (leads ?? []).map((l) => l.id);
  const { data: enr } = leadIds.length
    ? await db.from("outreach_enrollments").select("lead_id, campaign:outreach_campaigns(id, name)").in("lead_id", leadIds.slice(0, 2000))
    : { data: [] as { lead_id: string; campaign: { id: string; name: string } | null }[] };
  const companyOf = new Map((leads ?? []).map((l) => [l.id, l.company_id!]));
  for (const r of rows ?? []) out.set(r.id, { people: 0, campaigns: [], updatedAt: r.last_updated, website: r.website ?? (r.domain ? `https://${r.domain}` : null), linkedinUrl: r.linkedin_url });
  for (const p of people ?? []) { const o = out.get(p.company_id!); if (o) o.people++; }
  for (const e of (enr ?? []) as unknown as { lead_id: string; campaign: { id: string; name: string } | null }[]) {
    const o = out.get(companyOf.get(e.lead_id) ?? "");
    if (o && e.campaign && !o.campaigns.some((c) => c.id === e.campaign!.id)) o.campaigns.push(e.campaign);
  }
  return out;
}
