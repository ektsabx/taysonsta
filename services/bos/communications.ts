import "server-only";
import { db } from "@/lib/bos/db";
import { scopeUserIds, type BosUser } from "@/lib/bos/auth";
import { myClientIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { communicationTypes } from "@/services/bos/activities";

// Unified communication history (§28): communication activities, synced
// email messages and meetings in one date-ordered feed.

export interface CommunicationFilters {
  client?: string;
  contact?: string;
  lead?: string;
  deal?: string;
  kind?: string; // activity type | "email_message" | "meeting"
  direction?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
}

export interface CommunicationItem {
  id: string;
  kind: string;
  source: "activity" | "email" | "meeting";
  title: string;
  body: string | null;
  direction: string | null;
  at: string;
  userId: string | null;
  clientId: string | null;
  contactId: string | null;
  leadId: string | null;
  dealId: string | null;
  status: string | null;
  href: string | null;
}

const PER_SOURCE = 300;
export const COMM_PAGE_SIZE = 50;

export async function listCommunications(bos: BosUser, scope: Scope, f: CommunicationFilters) {
  const clientIds = await myClientIds(bos, scope);
  const users = await scopeUserIds(bos, scope);
  const esc = (s: string) => s.replace(/[%_,()]/g, " ").trim();
  const wantActivity = !f.kind || (communicationTypes as string[]).includes(f.kind);
  const wantEmail = (!f.kind || f.kind === "email_message") && !(f.direction === "internal");
  const wantMeeting = (!f.kind || f.kind === "meeting") && !f.direction;

  const tasks: Promise<CommunicationItem[]>[] = [];

  if (wantActivity) {
    let q = db().from("activities").select("id, type, title, description, direction, created_at, completed_at, start_at, created_by, assigned_to, client_id, contact_id, lead_id, deal_id, status").is("archived_at", null);
    q = f.kind && f.kind !== "meeting" ? q.eq("type", f.kind as "call") : q.in("type", communicationTypes);
    if (users) {
      const list = users.join(",");
      q = q.or([`created_by.in.(${list})`, `assigned_to.in.(${list})`, ...(clientIds?.length ? [`client_id.in.(${clientIds.join(",")})`] : [])].join(","));
    }
    if (f.client) q = q.eq("client_id", f.client);
    if (f.contact) q = q.eq("contact_id", f.contact);
    if (f.lead) q = q.eq("lead_id", f.lead);
    if (f.deal) q = q.eq("deal_id", f.deal);
    if (f.direction) q = q.eq("direction", f.direction);
    if (f.from) q = q.gte("created_at", `${f.from}T00:00:00Z`);
    if (f.to) q = q.lte("created_at", `${f.to}T23:59:59Z`);
    if (f.q) q = q.or(`title.ilike.%${esc(f.q)}%,description.ilike.%${esc(f.q)}%`);
    tasks.push(
      Promise.resolve(q.order("created_at", { ascending: false }).limit(PER_SOURCE).then(({ data }) =>
        (data ?? []).map((a) => ({
          id: a.id, kind: a.type, source: "activity" as const, title: a.title, body: a.description, direction: a.direction,
          at: a.completed_at ?? a.start_at ?? a.created_at, userId: a.created_by ?? a.assigned_to, clientId: a.client_id, contactId: a.contact_id,
          leadId: a.lead_id, dealId: a.deal_id, status: a.status, href: null,
        }) as CommunicationItem),
      )),
    );
  }

  if (wantEmail) {
    let q = db().from("email_messages").select("id, direction, from_address, subject, body_text, sent_at, contact_id, email_threads!inner(id, client_id, lead_id, deal_id)");
    if (clientIds) q = clientIds.length ? q.in("email_threads.client_id", clientIds) : q.eq("email_threads.client_id", "00000000-0000-0000-0000-000000000000");
    if (f.client) q = q.eq("email_threads.client_id", f.client);
    if (f.lead) q = q.eq("email_threads.lead_id", f.lead);
    if (f.deal) q = q.eq("email_threads.deal_id", f.deal);
    if (f.contact) q = q.eq("contact_id", f.contact);
    if (f.direction === "inbound") q = q.eq("direction", "incoming");
    if (f.direction === "outbound") q = q.eq("direction", "outgoing");
    if (f.from) q = q.gte("sent_at", `${f.from}T00:00:00Z`);
    if (f.to) q = q.lte("sent_at", `${f.to}T23:59:59Z`);
    if (f.q) q = q.or(`subject.ilike.%${esc(f.q)}%,body_text.ilike.%${esc(f.q)}%`);
    tasks.push(
      Promise.resolve(q.order("sent_at", { ascending: false }).limit(PER_SOURCE).then(({ data }) =>
        (data ?? []).map((m) => {
          const t = m.email_threads as unknown as { client_id: string | null; lead_id: string | null; deal_id: string | null };
          return {
            id: m.id, kind: "email_message", source: "email" as const, title: m.subject ?? "(بدون عنوان)", body: m.body_text ? m.body_text.slice(0, 400) : null,
            direction: m.direction === "incoming" ? "inbound" : "outbound", at: m.sent_at, userId: null, clientId: t.client_id, contactId: m.contact_id,
            leadId: t.lead_id, dealId: t.deal_id, status: null, href: null,
          } as CommunicationItem;
        }),
      )),
    );
  }

  if (wantMeeting) {
    let q = db().from("meetings").select("id, title, notes, outcome, start_at, organizer_id, client_id, contact_id, lead_id, deal_id, status");
    if (users) {
      const list = users.join(",");
      q = q.or([`organizer_id.in.(${list})`, `created_by.in.(${list})`, ...(clientIds?.length ? [`client_id.in.(${clientIds.join(",")})`] : [])].join(","));
    }
    if (f.client) q = q.eq("client_id", f.client);
    if (f.contact) q = q.eq("contact_id", f.contact);
    if (f.lead) q = q.eq("lead_id", f.lead);
    if (f.deal) q = q.eq("deal_id", f.deal);
    if (f.from) q = q.gte("start_at", `${f.from}T00:00:00Z`);
    if (f.to) q = q.lte("start_at", `${f.to}T23:59:59Z`);
    if (f.q) q = q.ilike("title", `%${esc(f.q)}%`);
    tasks.push(
      Promise.resolve(q.order("start_at", { ascending: false }).limit(PER_SOURCE).then(({ data }) =>
        (data ?? []).map((m) => ({
          id: m.id, kind: "meeting", source: "meeting" as const, title: m.title, body: m.outcome ?? m.notes, direction: null, at: m.start_at,
          userId: m.organizer_id, clientId: m.client_id, contactId: m.contact_id, leadId: m.lead_id, dealId: m.deal_id,
          status: m.status, href: `/admin/communication/meetings/${m.id}`,
        }) as CommunicationItem),
      )),
    );
  }

  const all = (await Promise.all(tasks)).flat().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const page = Math.max(1, f.page ?? 1);
  return { rows: all.slice((page - 1) * COMM_PAGE_SIZE, page * COMM_PAGE_SIZE), total: all.length, page, pageSize: COMM_PAGE_SIZE, truncated: all.length >= PER_SOURCE };
}
